# Phase-wise Roadmap — RANOps AI

| | |
|---|---|
| Purpose | Working checklist for each phase: tasks, tests, acceptance, and commit plan. Update the tracker and tick boxes as work lands. |
| Source | [`../RANOps_AI_PROJECT.md` §19](../RANOps_AI_PROJECT.md) — phases and acceptance criteria must match it. |
| Working rules | One phase at a time · do not start the next phase until acceptance is met · every phase ends deployed and verified on the public URLs (from Phase 0 on) · each phase is delivered as **4–6 focused commits** · push only when asked. |

---

## Progress tracker

| Phase | Name | Status | Started | Completed | Notes |
|---|---|---|---|---|---|
| — | Planning docs (spec, requirements, context) | ✅ Done | 2026-11-20 | 2026-11-20 | |
| 0 | Foundation + skeleton deployment | ⏳ Not started | | | |
| 1 | Data model + topology | ⏳ | | | |
| 2 | Telemetry simulator | ⏳ | | | |
| 3 | Fault injection (slice: 3 scenarios) | ⏳ | | | |
| 4 | Detection | ⏳ | | | |
| 5 | Incidents | ⏳ | | | |
| 6 | Investigation (deterministic) | ⏳ | | | |
| 7 | Evaluation + benchmarks (slice complete) | ⏳ | | | |
| 8 | Remaining scenarios + Mystery + optional AI | ⏳ | | | |
| 9 | Reports + polish | ⏳ | | | |
| 10 | Testing + hardening | ⏳ | | | |
| 11 | Final public release | ⏳ | | | |

Status legend: ⏳ not started · 🔄 in progress · ✅ done · ⚠️ blocked.

## Phase report template

After every phase, record in this file (under the phase):

```text
Changed files:      <list / summary>
Commands run:       <tests, builds, migrations, deploy checks>
Results:            <pass/fail counts, measurements → performance_review.md, benchmark.md>
Deployed:           <frontend URL / backend URL / commit SHA>
Remaining issues:   <known gaps, follow-ups>
```

---

## Phase 0 — Foundation and skeleton deployment

**Goal:** both apps run locally and in production on free tiers, talking to each other.

Tasks
- [ ] `backend/`: FastAPI app factory, `Settings` (pydantic-settings), structured logging, error envelope, CORS, GZip, timing middleware.
- [ ] `/health` (no DB) and `/health/ready` (DB `SELECT 1`).
- [ ] SQLAlchemy engine/session for Neon (pooled URL, `prepare_threshold=None`, small pool); Alembic initialised (empty baseline migration).
- [ ] `backend/.python-version` (3.12), `requirements.txt`, `requirements-dev.txt`, `Dockerfile`, ruff config, pytest setup.
- [ ] `frontend/`: Vite + React + TS, Tailwind, shadcn/ui init, React Router, TanStack Query, ESLint, `npm run typecheck`.
- [ ] App shell with nav for all planned pages (pages show "coming in phase N" text, **no dead buttons**).
- [ ] `useBackendWarmup` + "Waking up the backend…" state; About page shows backend health.
- [ ] `frontend/vercel.json` SPA rewrites.
- [ ] `.env.example` with every variable from the spec.
- [ ] `.github/workflows/ci.yml` (backend lint+test with Postgres service, frontend lint+typecheck+build).
- [ ] Create Neon project, Render service, Vercel project (see [`deployment.md`](deployment.md)); deploy; set env vars and CORS.
- [ ] Measure: idle memory in `docker run --memory=512m --cpus=0.1`; cold start time on Render → [`performance_review.md`](performance_review.md).

Tests
- [ ] `/health` returns 200 and opens no DB connection.
- [ ] `/health/ready` returns 200 with DB, 503 without.
- [ ] Settings load from env; missing optional AI keys are fine.
- [ ] Frontend builds; warm-up hook unit test (optional).

Acceptance
- [ ] Both apps run locally; frontend calls backend.
- [ ] Deployed frontend calls deployed backend (including after cold start).
- [ ] CI green. No payment method used.

Commit plan (example)
1. `chore: scaffold FastAPI backend with settings, logging, and health checks`
2. `chore: add database session, Alembic baseline, and Dockerfile`
3. `chore: scaffold React + Vite frontend with routing, query client, and app shell`
4. `feat(frontend): add backend warm-up gate and about page health status`
5. `ci: add GitHub Actions workflow for backend and frontend`
6. `chore: add deployment config (vercel.json, .env.example) and update docs`

---

## Phase 1 — Data model and topology

Tasks
- [ ] ORM models for all public tables + `evaluation` schema tables; Alembic migration creating both schemas and indexes.
- [ ] Seed script (`python -m scripts.seed`): `demo-small`, `demo-medium` (keys per system_design §1), public scenario definitions, placeholder-free.
- [ ] Topology service: build/cached NetworkX graph, upstream/downstream/impact set, hop distance.
- [ ] APIs: `GET /topologies`, `/topologies/{id}`, `/topologies/{id}/graph`, `/components/{id}`.
- [ ] Topology page: React Flow layout (layered top-down), node colours by type, link-type styling, filters, legend, details panel.
- [ ] "Synthetic demo data" label in the shell.

Tests: migration up/down on empty DB · seed idempotent · traversal results for both topologies · API schemas.
Acceptance: user can view both graphs and inspect components on the deployed app.

Commit plan: models+migration · seed script · topology service+tests · topology API · topology page.

---

## Phase 2 — Telemetry simulator

Tasks
- [ ] Metric catalogue + per-type mapping + baselines (system_design §2).
- [ ] Deterministic generator (SeedSequence per series, crc32 keys), diurnal, drift, noise, harmless spikes, coupling, clamping.
- [ ] `telemetry_series` persistence (bulk insert), run lifecycle, `JobRunner`, startup recovery.
- [ ] `POST /simulations` (normal only for now), `GET /simulations`, `/{id}`, `/{id}/status`, `/{id}/telemetry` with downsampling.
- [ ] Telemetry explorer page; simulation list + detail; polling.
- [ ] Visitor-run limits: `MAX_RUN_POINTS`, `expires_at`, `MAX_VISITOR_RUNS`; rate limit on `POST /simulations`.

Tests: same seed ⇒ identical arrays · different seed ⇒ different · values within valid ranges · not flat · storage per run < 0.5 MB · startup recovery.
Acceptance: user can start a normal run and explore time series.

Commit plan: metric catalogue+generator · persistence+jobs · simulation API · telemetry UI · limits+recovery.

---

## Phase 3 — Fault injection (first slice)

Tasks
- [ ] Fault catalogue (code) for `backhaul_degradation`, `cell_congestion`, `normal_variation`.
- [ ] Injector + propagation with attenuation; onset ramp.
- [ ] `evaluation.writer` (write-only); store run fault config + ground truth.
- [ ] Scenario library page; launcher with scenario/target/severity/duration/seed.
- [ ] Architecture tests: import boundaries + leak test scaffold.

Tests: each fault changes intended metrics on target + impact set · normal_variation has no persistent deviation · fixed seed reproducible · public APIs expose no hidden fields · import boundary test.
Acceptance: faults produce expected KPI changes; seeds reproduce; boundary tests pass.

Commit plan: catalogue+injector · evaluation writer+schema use · scenario+launcher API · UI · architecture tests.

---

## Phase 4 — Detection

Tasks
- [ ] `stat` detector (robust z, polarity, persistence) · `gap` detector · `iforest` (per type, training seeds 1000–1019, in-memory cache).
- [ ] Alert grouping (union-find, G=5, ≤2 hops).
- [ ] Detection matching + metrics (system_design §5.5).
- [ ] `GET /detectors`, `POST /simulations/{id}/detect`, `GET /simulations/{id}/detections`.
- [ ] Chart overlays: anomaly markers, gap markers, threshold band.

Tests: zero variance · missing values · persistence suppresses 1–2 point spikes · gap detection · iforest determinism · grouping merges related detections.
Acceptance: fault scenarios produce detectable anomalies; normal controls give measurable FP rate. Record first numbers in [`benchmark.md`](benchmark.md) only after a documented run.

---

## Phase 5 — Incidents

Tasks: incident creation from groups · detection-derived titles · incidents API (list/filter/detail/PATCH) · incidents page + timeline + evidence · topology highlighting.
Tests: titles never contain scenario IDs/labels · filters · PATCH status transitions.
Acceptance: user navigates detection → incident detail.

---

## Phase 6 — Investigation (deterministic)

Tasks
- [ ] Runbooks for slice fault types (+ `no_fault`), controlled check-ID vocabulary.
- [ ] Context builder (whitelist) · LangGraph graph with 8 nodes (lazy import) · `DemoInvestigationProvider`.
- [ ] Confidence + abstention (agent v1) · diagnosis schema validation.
- [ ] Investigation API + investigation detail page.

Tests: evidence values match stored data · leak test over all slice scenarios · abstains on ambiguous input · schema validity.
Acceptance: diagnosis evidence maps to stored observations; no hidden truth in inference.

---

## Phase 7 — Evaluation and benchmarks (slice complete)

Tasks
- [ ] Evaluation repository (only reader of `evaluation`) · scorers (system_design §7) · evaluate + get-evaluation APIs.
- [ ] Benchmark suite `slice-v1` · orchestrator (in-memory regeneration) · comparison + regression flags · benchmark pages.
- [ ] Redeploy; run the full slice on the public URL.

Tests: scorer unit tests with hand-made cases · repeatable scores · evaluation endpoint 404 before evaluation · benchmark persists no telemetry.
Acceptance: repeatable scores; ground truth hidden until evaluation; full slice works publicly. Record results in [`benchmark.md`](benchmark.md).

---

## Phase 8 — Widen scenarios and optional AI

Tasks: remaining 7 scenarios + runbooks · Mystery incident · suite `full-v1` · optional Gemini/Groq provider with timeout, ≤2 retries, fallback, `AI_DAILY_CAP`, per-incident caching, `ai_usage`.
Tests: every scenario passes slice-level tests · AI disabled ⇒ identical behaviour · fallback labelling · cap enforcement (provider mocked).
Acceptance: all ten scenarios pass; app identical without AI.

---

## Phase 9 — Reports and polish

Tasks: Jinja2 HTML reports (incident, benchmark) + print CSS · loading/empty/error/success/cold-start states everywhere · responsive layout · dashboard metrics · README screenshots.
Acceptance: core workflows usable without developer help.

---

## Phase 10 — Testing and hardening

Tasks: complete unit/integration/resource/E2E tests · input/size/rate limits · run expiry + `POST /admin/cleanup` + `cleanup.yml` · query optimisation · local benchmark CLI for larger suites.
Acceptance: critical tests pass from clean setup and in CI; performance budgets met ([`performance_review.md`](performance_review.md)).

---

## Phase 11 — Final public release

Tasks: seed showcase run + showcase benchmark from dev machine · enable cleanup (and optional keep-warm) workflows · verify free-tier budget · demo GIF/video in README · clean-browser E2E on public URLs · update README status table.
Acceptance: public demo works end-to-end with no paid service or API key; Definition of Done (spec §20) fully checked.
