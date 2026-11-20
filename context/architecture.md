# Architecture — RANOps AI

| | |
|---|---|
| Purpose | How the system is structured: deployment topology, layers, module boundaries, request flows, and the key decisions behind them. |
| Companion | [`system_design.md`](system_design.md) for algorithms, defaults, schemas. |
| Update rule | Any new module, cross-module import, external service, or architectural decision must be reflected here (add an ADR in §9). |

---

## 1. Deployment topology

```text
                    ┌──────────────────────────────┐
  Reviewer browser  │  Vercel Hobby                │
  ────────────────▶ │  React + Vite SPA (static)   │
                    └──────────────┬───────────────┘
                                   │ HTTPS REST (CORS), VITE_API_BASE_URL
                                   ▼
                    ┌──────────────────────────────┐        optional, on click only
                    │  Render free web service     │ ─────────────────────────────▶ Gemini / Groq
                    │  FastAPI + in-process jobs   │                                (free tier)
                    │  ~512 MB RAM, sleeps @15 min │
                    └──────────────┬───────────────┘
                                   │ psycopg 3, TLS, pooled URL
                                   ▼
                    ┌──────────────────────────────┐
                    │  Neon free PostgreSQL        │
                    │  schemas: public, evaluation │
                    └──────────────────────────────┘

  GitHub Actions: CI on push/PR · daily cleanup (POST /admin/cleanup) · optional keep-warm (GET /health)
  Developer machine: seed script (topologies, scenarios, runbooks, showcase) via DIRECT_DATABASE_URL
```

---

## 2. Backend layers

```text
api/        HTTP only: routing, request/response schemas, status codes, rate limits. No business logic, no SQL.
  │
services/   Business logic. Each service owns its domain and its repository functions.
  │
db/ models/ SQLAlchemy engine/session, ORM models (public + evaluation).
core/       Config (pydantic-settings), logging, errors, versions, rate limiter, security helpers.
```

Rules:
- Routers call services; services call repositories/ORM; routers never touch the session directly except to pass it in via dependency injection.
- Pydantic schemas in `schemas/` are the API contract; ORM models never leak out of `services/`.
- Public response schemas never declare hidden fields.

---

## 3. World side vs observer side (the evaluation boundary)

The core architectural idea: split the backend into the part that **knows the truth** and the part that must **infer it**.

| Side | Modules | May know the fault? |
|---|---|---|
| **World** | `services/simulation`, `services/faults`, `services/evaluation`, `services/benchmarks` (orchestrator) | Yes |
| **Observer** | `services/detection`, `services/incidents`, `services/investigation`, `services/runbooks`, `services/topology`, all public `api/` routers | **No** |

### Allowed imports

| From ↓ / To → | faults | evaluation.writer | evaluation (other) | models.evaluation | observer services |
|---|---|---|---|---|---|
| simulation | ✅ | ✅ | ❌ | ❌ | topology only |
| faults | — | ❌ | ❌ | ❌ | topology only |
| evaluation | ✅ (catalogue) | ✅ | ✅ | ✅ | read results only |
| benchmarks | ✅ | ✅ | ✅ | ❌ | ✅ (passes telemetry only) |
| observer services | ❌ | ❌ | ❌ | ❌ | ✅ |
| api (public routers) | ❌ | ❌ | ❌ | ❌ | ✅ |
| api/evaluation router | ❌ | ❌ | ✅ (public facade) | ❌ | — |

- `services/evaluation/writer.py` is a **write-only** port: `record_run_fault(run_id, config)`, `record_ground_truth(run_id, truth)`. It exposes no read functions.
- `services/evaluation/repository.py` is the only code that reads the `evaluation` schema.
- `tests/architecture/test_import_boundaries.py` parses imports (AST) and enforces this table.
- `tests/architecture/test_no_leak.py` serializes the investigation context for every scenario and asserts no hidden values appear.

> Ground truth is hidden from the inference pipeline and public API — not from people reading the source code. The fault catalogue lives in the repo.

---

## 4. Backend module layout

```text
backend/app/
├── main.py                    # create_app(): middleware, routers, startup/shutdown hooks
├── core/
│   ├── config.py              # Settings (pydantic-settings), reads env vars
│   ├── logging.py             # structured logging, secret redaction
│   ├── errors.py              # AppError hierarchy → JSON error envelope
│   ├── rate_limit.py          # slowapi limiter + per-route limits
│   └── versions.py            # SIM_VERSION, detector/agent versions
├── db/
│   ├── session.py             # engine (pool_size=3, pre_ping, prepare_threshold=None), SessionLocal
│   └── base.py                # DeclarativeBase, naming conventions
├── models/
│   ├── public/                # topology, runs, telemetry, detections, incidents, investigations, …
│   └── evaluation/            # run_fault_configs, scenario_hidden, scenario_ground_truth
├── schemas/                   # Pydantic request/response models per domain
├── api/
│   ├── health.py              # /health, /health/ready
│   └── v1/                    # one router per domain + admin
└── services/
    ├── topology/              # graph building, traversal, cache
    ├── simulation/            # normal generator, run lifecycle, telemetry repository
    ├── faults/                # catalogue, injectors, propagation
    ├── detection/             # stat, iforest, gap, matching
    ├── incidents/             # grouping, titles, incident repository
    ├── investigation/         # context builder, providers, LangGraph graph
    ├── runbooks/              # catalogue loader, keyword retrieval
    ├── evaluation/            # writer (port), repository, scorers
    ├── benchmarks/            # suites, orchestrator, comparison
    ├── reports/               # HTML rendering (Jinja2 templates + print CSS)
    └── jobs/                  # JobRunner, startup recovery, cleanup
```

---

## 5. Request flows

### 5.1 Run a scenario end-to-end

```text
UI Launcher ──POST /simulations──▶ api.simulations ──▶ simulation.start_run()
                                         │                 ├─ insert simulation_runs (status=queued, label)
                                   202 {id}                └─ JobRunner.submit(run_pipeline)
UI polls /simulations/{id}/status ◀──────┘
                                   JobRunner (thread):
                                     simulation.generate_normal()      → arrays in memory
                                     faults.inject()                    → modified arrays
                                     evaluation.writer.record_*()       → evaluation schema
                                     simulation.persist_series()        → telemetry_series
                                     status = completed
UI ──POST /simulations/{id}/detect──▶ detection.run(run_id)  (job)
                                     reads telemetry_series → stat/iforest/gap → detection_results
                                     incidents.group(run_id) → incidents
UI ──POST /incidents/{id}/investigate──▶ investigation.investigate(incident_id, provider)
                                     context builder (whitelist) → LangGraph → investigations
UI ──POST /simulations/{id}/evaluate──▶ evaluation.evaluate(run_id)
                                     repository reads ground truth + diagnosis → evaluation_results
UI ──GET /simulations/{id}/evaluation──▶ scores (+ reveal scenario for Mystery runs)
```

### 5.2 Benchmark

```text
POST /benchmarks {suite, detector_versions, agent_version}
  → benchmarks.orchestrator (job): for each case (scenario, topology, seed):
        world: generate + inject in memory (no persistence)
        observer: detect → group → investigate (receives arrays only)
        evaluator: score against in-memory truth
     → benchmark_case_results rows, aggregate_metrics on benchmark_runs
GET /benchmarks/{id}/compare?against={other_id} → per-metric deltas, regressions flagged
```

### 5.3 Cold start

```text
Browser loads SPA from Vercel (instant)
  → useBackendWarmup(): GET /health with 90 s timeout, retry with backoff
       pending > 2 s → show "Waking up the backend (free hosting, ~30–60 s)…"
       ok → enable data queries (TanStack Query `enabled` flag)
/health never touches Neon, so Neon stays asleep until real data is requested.
```

---

## 6. Frontend architecture

```text
frontend/src/
├── app/            # App shell, providers (QueryClient, Router), layout, nav, warm-up gate
├── routes/         # route definitions (lazy-loaded pages)
├── features/<x>/   # pages, components, hooks (useXQuery), api calls for one domain
├── components/     # shared UI (shadcn/ui wrappers, charts, status badges, empty/error states)
├── lib/            # api client (fetch wrapper, base URL, error envelope), formatters
├── hooks/          # cross-feature hooks (useBackendWarmup, usePolling)
└── types/          # API types (hand-written to mirror Pydantic schemas; optional OpenAPI codegen later)
```

Routes:

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/topology` | Topology explorer |
| `/telemetry` | Telemetry explorer |
| `/scenarios` | Scenario library |
| `/simulations`, `/simulations/new`, `/simulations/:runId` | Runs, launcher, run detail |
| `/incidents`, `/incidents/:incidentId` | Incidents, investigation detail |
| `/benchmarks`, `/benchmarks/:benchmarkId` | Benchmarks, comparison |
| `/about` | Settings / About (read-only) |

Reports open the backend HTML endpoint in a new tab.

Conventions:
- Server state only via TanStack Query; no global client store unless needed.
- Polling: `refetchInterval` while a run/job is `queued`/`running`.
- React Flow and Recharts pages are `lazy()`-loaded to keep the initial bundle small.
- All API errors render the shared error component with the backend `error.code`.

---

## 7. Cross-cutting concerns

| Concern | Approach |
|---|---|
| Configuration | `pydantic-settings` `Settings` object; all env vars in `.env.example`; frontend only reads `VITE_*` vars |
| Logging | JSON-ish structured logs to stdout (Render captures); request id, path, status, duration; never log secrets or full DB URLs |
| Errors | `AppError(code, message, status)` → global handler → error envelope; unexpected errors → 500 with generic message |
| Rate limiting | slowapi keyed by client IP (respect `X-Forwarded-For` from Render's proxy) |
| CORS | `CORS_ORIGINS` exact + `CORS_ORIGIN_REGEX` for Vercel previews |
| Compression | `GZipMiddleware(minimum_size=1024)` |
| Timing | middleware adds `X-Process-Time` header and logs it (input to performance review) |
| Security | request size limit, admin token compare with `secrets.compare_digest`, no secrets in responses |

---

## 8. Data ownership

| Table | Owner service | Writers | Readers |
|---|---|---|---|
| topologies, network_components, topology_edges | topology | seed script | all |
| scenario_definitions | faults (public part) | seed script | all |
| simulation_runs | simulation | simulation, jobs | all (label not readable by investigation) |
| telemetry_series | simulation | simulation | detection, investigation, api |
| detection_results | detection | detection | incidents, investigation, api |
| incidents | incidents | incidents | investigation, api |
| investigations | investigation | investigation | evaluation, api |
| evaluation.* | evaluation | evaluation.writer | evaluation.repository only |
| evaluation_results | evaluation | evaluation | api (after evaluation) |
| benchmark_runs, benchmark_case_results | benchmarks | benchmarks | api |
| runbooks | runbooks | seed script | investigation, api |
| ai_usage | investigation | investigation | investigation, api (remaining quota) |

---

## 9. Architecture decision records (ADR)

| # | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| ADR-01 | FastAPI (Python) backend | NumPy/scikit-learn/NetworkX/LangGraph ecosystem; typed with Pydantic | Node backend, Streamlit (spec forbids) |
| ADR-02 | PostgreSQL arrays per series instead of row-per-point or a TSDB | ~40× smaller; fits Neon free 1 GB; one fewer service | TimescaleDB/Influx (extra service, cost), row-per-point (size) |
| ADR-03 | Regenerate benchmark telemetry from seeds | Determinism makes storage unnecessary | Persisting benchmark telemetry (storage blow-up) |
| ADR-04 | In-process job runner, no Redis/worker | Workers and Redis are not free on the chosen host | Celery/RQ + Redis |
| ADR-05 | World/observer split + `evaluation` schema + import tests | Makes evaluation integrity enforceable, not just documented | Field hiding in API responses only |
| ADR-06 | Neon for Postgres | Free tier persists indefinitely; scales to zero | Render Postgres (deleted after 30 days), Supabase (pauses when idle) |
| ADR-07 | Render free for backend, Docker image | Free, supports scientific Python; Dockerfile keeps us portable | Vercel Python functions (size limits), Fly/Railway/Cloud Run (no lasting free tier) |
| ADR-08 | Deterministic demo investigator is default; LLM optional and capped | Zero-cost, reproducible benchmarks, no quota risk | LLM-first design |
| ADR-09 | Isolation Forest retrained in memory, never saved | Ephemeral disk; training is small and deterministic | Pickles on disk or in DB |
| ADR-10 | `/health` without DB | Keep-warm pings must not keep Neon awake (compute-hour budget) | DB-backed health check |
| ADR-11 | HTML reports + print CSS | No heavy PDF libraries on a 512 MB instance | WeasyPrint/Playwright PDF on server |
| ADR-12 | Seed and showcase computed on the developer machine | Heavy one-off work never runs on the free instance | Seeding on server startup |
