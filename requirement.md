# RANOps AI — Requirements Specification

| | |
|---|---|
| Source of truth | [`RANOps_AI_PROJECT.md`](RANOps_AI_PROJECT.md). If this file and the project spec disagree, the project spec wins and this file is corrected. |
| Detailed design | [`context/system_design.md`](context/system_design.md), [`context/architecture.md`](context/architecture.md) |
| Status | Draft v1 — written before Phase 0. Requirement IDs are stable; reference them in commits, tests, and PRs. |

Priorities: **Must** (required for the Definition of Done), **Should** (expected, may slip one phase), **Could** (optional).

---

## 1. Purpose and scope

RANOps AI is an educational, simulation-only 5G / Open RAN operations platform. It generates synthetic telemetry for a simplified RAN topology, injects controlled faults, detects anomalies, groups them into incidents, investigates incidents with evidence, and scores the diagnosis against hidden ground truth. It is deployed publicly as a portfolio demo at zero cost.

It is **not** an Airspan product and never connects to real network equipment.

---

## 2. Constraints

| ID | Constraint |
|---|---|
| C-01 | **Zero cost.** Every service (hosting, database, CI, LLM) must be usable on a free tier without a payment method. |
| C-02 | Frontend on Vercel Hobby, backend on Render free web service, database on Neon free, CI/cron on GitHub Actions. |
| C-03 | Backend is Python (FastAPI). Node is used only for frontend tooling. No Streamlit. |
| C-04 | No connection to, or control of, real telecom equipment. No execution of LLM-generated commands. |
| C-05 | The full workflow works without any AI API key (demo mode is the default). |
| C-06 | Simulation is deterministic: identical inputs + seed ⇒ identical telemetry. |
| C-07 | Hidden ground truth and fault configuration never reach inference code or public APIs. |
| C-08 | No user accounts in the MVP; the public demo is protected by rate limits, quotas, and expiry. |
| C-09 | Backend memory stays within the free instance (~512 MB); peak target < 400 MB. |
| C-10 | Database stays well inside Neon's free 1 GB (budget < 300 MB). |
| C-11 | The backend writes nothing persistent to local disk (ephemeral filesystem). |
| C-12 | "Airspan" appears only in disclaimers — never in repo/app/package/domain names. |

---

## 3. Functional requirements

### 3.1 Topology — `FR-TOP`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-TOP-01 | Seed two topologies: `demo-small` (13 components) and `demo-medium` (23 components). | Must | 1 |
| FR-TOP-02 | Component types: UE group, Cell, RU, DU, CU, Transport link (backhaul / midhaul / fronthaul), Core endpoint. | Must | 1 |
| FR-TOP-03 | Each component has a stable key, name, type, status, metadata, and graph relationships. | Must | 1 |
| FR-TOP-04 | Graph traversal (upstream/downstream/neighbours) via NetworkX. | Must | 1 |
| FR-TOP-05 | Interactive topology view (React Flow) with component details, type/status filters, and legend. | Must | 1 |
| FR-TOP-06 | Incident-affected components are highlighted on the topology. | Must | 5 |
| FR-TOP-07 | Topologies are created only by the seed script (no public create endpoint). | Must | 1 |

### 3.2 Telemetry simulation — `FR-SIM`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-SIM-01 | Generate per-component telemetry for the applicable metrics of each component type. | Must | 2 |
| FR-SIM-02 | Normal telemetry includes noise, periodic patterns, gradual drift, and harmless spikes; never flat. | Must | 2 |
| FR-SIM-03 | Defaults: 60 s interval, 360 points, 180-point warm-up; hard cap `MAX_RUN_POINTS` = 720. | Must | 2 |
| FR-SIM-04 | Same topology + scenario + simulator version + config + seed ⇒ bit-identical data. | Must | 2 |
| FR-SIM-05 | Store telemetry as one row per series (`REAL[]` values), not one row per point. | Must | 2 |
| FR-SIM-06 | Run lifecycle (`queued → running → completed / failed`) persisted and pollable. | Must | 2 |
| FR-SIM-07 | Telemetry API supports filters and server-side downsampling (`max_points`). | Must | 2 |

### 3.3 Fault injection — `FR-FLT`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-FLT-01 | Slice scenarios: backhaul degradation, cell congestion, normal variation. | Must | 3 |
| FR-FLT-02 | Remaining scenarios: RU failure, handover failure spike, radio interference, traffic surge, DU saturation, cell outage, KPI drift. | Must | 8 |
| FR-FLT-03 | User chooses scenario, target, severity, duration, seed. | Must | 3 |
| FR-FLT-04 | Mystery incident: server picks scenario/target/severity/seed and hides them until evaluation. | Must | 8 |
| FR-FLT-05 | Faults modify telemetry only; they never write detector output. | Must | 3 |
| FR-FLT-06 | Fault configuration and ground truth are stored in the `evaluation` schema. | Must | 3 |
| FR-FLT-07 | One fault per run; overlapping faults only after the single-fault pipeline is reliable. | Could | — |

### 3.4 Detection — `FR-DET`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-DET-01 | Rolling statistical detector (robust median/MAD), configurable threshold, minimum history, persistence rule. | Must | 4 |
| FR-DET-02 | Isolation Forest detector trained only on normal runs from the training seed range; model kept in memory. | Must | 4 |
| FR-DET-03 | Data-gap detector flags ≥ N consecutive missing points (default 3). | Must | 4 |
| FR-DET-04 | Detection results carry run, component, metric, window, observed, baseline, score, detector version, threshold, severity, explanation. | Must | 4 |
| FR-DET-05 | Detection metrics (precision, recall, F1, FP rate, FN, delay, alert count) with documented matching rules. | Must | 4 |
| FR-DET-06 | Anomaly markers, data-gap markers, and threshold overlays on charts. | Must | 4 |

### 3.5 Incidents — `FR-INC`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-INC-01 | Group detections by topology proximity and time window; never one incident per point. | Must | 4–5 |
| FR-INC-02 | Incident titles are generated from detections, never from scenario names. | Must | 5 |
| FR-INC-03 | List/filter incidents by severity, status, component, time; detail view with timeline and evidence. | Must | 5 |
| FR-INC-04 | Incident status can be updated (`open`, `investigating`, `resolved`). | Should | 5 |

### 3.6 Investigation — `FR-INV`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-INV-01 | Eight-step workflow (load → summarize → topology → runbook → hypotheses → verify → confidence → format) in LangGraph. | Must | 6 |
| FR-INV-02 | Input whitelist: incident, detections, telemetry, topology, runbooks only. | Must | 6 |
| FR-INV-03 | Structured diagnosis: primary hypothesis, affected components, evidence, alternatives, recommended checks, confidence, abstained, provider, is_fallback. | Must | 6 |
| FR-INV-04 | Every evidence item references a real stored observation. | Must | 6 |
| FR-INV-05 | Deterministic confidence score and abstention rule, versioned with the agent. | Must | 6 |
| FR-INV-06 | Versioned runbooks per fault type; keyword retrieval. | Must | 6 / 8 |
| FR-INV-07 | `DemoInvestigationProvider` (deterministic) always available and default. | Must | 6 |
| FR-INV-08 | Optional free-tier LLM provider (Gemini; Groq alternative) behind the same interface, with timeout, retries, fallback, daily cap, caching. | Could | 8 |

### 3.7 Evaluation — `FR-EVA`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-EVA-01 | Only the evaluation service reads ground truth. | Must | 7 |
| FR-EVA-02 | Scores revealed only after inference completes. | Must | 7 |
| FR-EVA-03 | Metrics: root-cause top-1/top-3, component accuracy, evidence precision/recall, check relevance, policy compliance, abstention quality. | Must | 7 |
| FR-EVA-04 | Deterministic scoring is primary; an LLM judge may only be supplementary. | Must | 7 |

### 3.8 Benchmarks — `FR-BEN`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-BEN-01 | Fixed, versioned suites (`slice-v1`, `full-v1`), ≤ 30 cases when run on the server. | Must | 7 / 8 |
| FR-BEN-02 | Benchmark telemetry is regenerated from seeds, never stored. | Must | 7 |
| FR-BEN-03 | Each benchmark records suite, simulator, detector, agent, provider versions, seeds, matching rules, timestamps. | Must | 7 |
| FR-BEN-04 | Compare two benchmarks and highlight regressions. | Must | 7 |
| FR-BEN-05 | Larger suites can be run locally through a CLI. | Should | 10 |

### 3.9 Reports — `FR-REP`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-REP-01 | HTML incident report and benchmark report. | Must | 9 |
| FR-REP-02 | Print stylesheet for browser "Save as PDF"; no server-side PDF. | Must | 9 |
| FR-REP-03 | Reports include configuration, versions, results, scores (post-evaluation), and limitations. | Must | 9 |

### 3.10 User interface — `FR-UI`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-UI-01 | Pages: Dashboard, Topology, Telemetry, Scenarios, Simulations (launcher + detail), Incidents, Investigation, Benchmarks, Reports, About/Settings. | Must | 1–9 |
| FR-UI-02 | Cold-start state: "Waking up the backend (free hosting, ~30–60 s)…". | Must | 0 |
| FR-UI-03 | Loading, empty, error, and success states on every data view. | Must | 9 |
| FR-UI-04 | Demo / synthetic data is clearly labelled. | Must | 1 |
| FR-UI-05 | No non-functional placeholder buttons. | Must | all |
| FR-UI-06 | Responsive down to tablet width. | Should | 9 |

### 3.11 Operations — `FR-OPS`

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-OPS-01 | `/health` (liveness, no DB) and `/health/ready` (DB check). | Must | 0 |
| FR-OPS-02 | Seed script runs from a developer machine and creates topologies, scenarios, runbooks, showcase run, showcase benchmark. | Must | 1 / 11 |
| FR-OPS-03 | Startup recovery marks interrupted jobs as failed and deletes expired visitor runs. | Must | 2 |
| FR-OPS-04 | Token-protected `POST /api/v1/admin/cleanup`, called daily by GitHub Actions. | Must | 10 |
| FR-OPS-05 | Optional keep-warm workflow pinging `/health`. | Could | 11 |

---

## 4. Non-functional requirements

Targets marked *(target)* are validated and recorded in [`context/performance_review.md`](context/performance_review.md).

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Memory | Backend peak RSS < 400 MB under the full workflow in a 512 MB container. |
| NFR-02 | Storage | One default `demo-medium` run stores < 0.5 MB; total database < 300 MB. |
| NFR-03 | Latency *(target)* | Warm read endpoints p95 < 300 ms (excluding network and Neon wake-up). |
| NFR-04 | Throughput *(target)* | Default run (simulate + detect) completes in < 15 s on the free instance. |
| NFR-05 | Payload | Telemetry chart responses < 100 KB gzip. |
| NFR-06 | Frontend *(target)* | Initial JS < 300 KB gzip; heavy libraries (React Flow, Recharts) code-split by route. |
| NFR-07 | Security | Secrets only in environment variables; never in frontend bundle, logs, or database. |
| NFR-08 | Security | Request bodies ≤ 64 KB; ORM / parameterized queries only; CORS restricted to known origins. |
| NFR-09 | Abuse | Per-IP rate limits, `MAX_VISITOR_RUNS`, `RUN_TTL_HOURS`, `AI_DAILY_CAP`. |
| NFR-10 | Integrity | Import-boundary, leak, and API-exposure tests must pass in CI. |
| NFR-11 | Reproducibility | Every result records the versions and seeds needed to reproduce it. |
| NFR-12 | Maintainability | Typed Pydantic schemas, SQLAlchemy 2 models, Alembic migrations, business logic in services. |
| NFR-13 | Quality | CI runs lint, type-check, tests, and frontend build on every push and PR. |
| NFR-14 | Portability | Backend ships as a Dockerfile so it can move between free hosts. |
| NFR-15 | Honesty | No invented metrics; results appear only after documented runs. |

---

## 5. Development toolchain

| Tool | Version | Purpose |
|---|---|---|
| Git | 2.4x+ | Version control |
| Python | 3.12 (pinned in `backend/.python-version`) | Backend |
| Node.js | 24 LTS (pinned in `frontend/.nvmrc`; 22+ works), with npm | Frontend tooling |
| Docker Desktop | current | Local Postgres, memory/CPU-limited backend tests (optional but recommended) |
| PostgreSQL | 16+ | Local via Docker, or a Neon `dev` branch (free plan allows branches) |

### Planned backend dependencies

`fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `sqlalchemy>=2`, `alembic`, `psycopg[binary]>=3`, `numpy`, `pandas` (lazy, only where useful), `scikit-learn`, `networkx`, `langgraph` (lazy), `slowapi`, `httpx`, `jinja2` (HTML reports).
Dev: `pytest`, `pytest-cov`, `ruff`, `mypy` (optional).
Optional providers: `google-genai` (Gemini), `groq`.

### Planned frontend dependencies

`react`, `react-dom`, `react-router`, `@tanstack/react-query`, `recharts`, `@xyflow/react` (React Flow), `tailwindcss`, shadcn/ui components (Radix primitives), `lucide-react`, `typescript` 7, `vite` 8, `oxlint`.

Exact versions are pinned in `backend/requirements.txt` and `frontend/package-lock.json` during Phase 0.

---

## 6. Accounts needed (all free)

| Service | Plan | Used for |
|---|---|---|
| GitHub | Free (public repo) | Code, CI, scheduled workflows |
| Vercel | Hobby | Frontend |
| Render | Free web service | Backend |
| Neon | Free | PostgreSQL |
| Google AI Studio / Groq | Free tier | Optional LLM investigation |

---

## 7. Acceptance

The project is accepted when the end-to-end scenario in [`RANOps_AI_PROJECT.md` §16](RANOps_AI_PROJECT.md) passes on the public deployment, every **Must** requirement is met, the Definition of Done (§20) is fully checked, and nothing in the stack requires payment.

---

## 8. Out of scope

- Real equipment, real network data, live remediation.
- Standards-complete 3GPP / O-RAN simulation.
- User accounts, multi-tenancy, RBAC.
- Production accuracy claims.
- Paid infrastructure of any kind.
