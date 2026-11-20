# RANOps AI

**5G / Open RAN network failure diagnosis, anomaly detection, and reliability-testing platform — built entirely on synthetic data and deployed at zero cost.**

> **Disclaimer:** Independent portfolio project inspired by the telecommunications and Open RAN domain served by Airspan Networks. It is a simulation, not an official Airspan product, and it does not connect to or control any real network equipment. All data is synthetic.

![status](https://img.shields.io/badge/status-in%20development-orange)
![python](https://img.shields.io/badge/python-3.12-blue)
![react](https://img.shields.io/badge/react-vite%20%2B%20typescript-61dafb)
![cost](https://img.shields.io/badge/hosting%20cost-%240-brightgreen)

---

## What it does

RANOps AI simulates a small 5G / Open RAN network, breaks it on purpose, and checks whether it can figure out what went wrong — honestly scored against a hidden answer key.

```text
 Topology ─▶ Synthetic telemetry ─▶ Fault injection ─▶ Anomaly detection
                                                            │
   Benchmarks ◀─ Evaluation (hidden ground truth) ◀─ Investigation ◀─ Incidents
```

1. **Simulate** a RAN topology (Core → backhaul → CU → midhaul → DU → fronthaul → RU → Cell → UEs).
2. **Generate** deterministic, realistic telemetry (noise, daily patterns, drift, harmless spikes).
3. **Inject** one of ten fault / control scenarios — or launch a blind *Mystery incident*.
4. **Detect** anomalies with a robust statistical detector, Isolation Forest, and a data-gap detector.
5. **Group** detections into incidents using topology and time.
6. **Investigate** with an evidence-grounded workflow (LangGraph) that cites real observations, offers alternatives, and abstains when unsure.
7. **Evaluate** the diagnosis against hidden ground truth that the investigator never sees.
8. **Benchmark** detector and agent versions on fixed, seeded scenario suites and flag regressions.

## Highlights

- **Evaluation integrity by design** — ground truth and fault configuration live in a separate `evaluation` schema; import-boundary and leak tests fail the build if inference code can reach them.
- **Fully deterministic** — every run, detector, and benchmark is reproducible from its versions and seed.
- **Works without an AI key** — a deterministic investigator is the default; an optional free-tier LLM can be enabled.
- **Zero-cost deployment** — Vercel + Render + Neon + GitHub Actions, engineered to fit free-tier memory, storage, and compute limits.

## Status

🚧 **Under active development.** Nothing below is claimed as finished until its phase is complete.

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation + skeleton deployment | 🔄 In progress — code and CI done, cloud deploy pending |
| 1 | Data model + topology | ⏳ |
| 2 | Telemetry simulator | ⏳ |
| 3 | Fault injection (first 3 scenarios) | ⏳ |
| 4 | Detection | ⏳ |
| 5 | Incidents | ⏳ |
| 6 | Investigation (deterministic) | ⏳ |
| 7 | Evaluation + benchmarks | ⏳ |
| 8 | All 10 scenarios, Mystery mode, optional AI | ⏳ |
| 9 | Reports + polish | ⏳ |
| 10 | Testing + hardening | ⏳ |
| 11 | Public release | ⏳ |

Live demo: *coming after Phase 0.*

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Recharts, React Flow |
| Backend | Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Alembic, NumPy, scikit-learn, NetworkX, LangGraph |
| Database | PostgreSQL (Neon) |
| CI / jobs | GitHub Actions |
| Hosting | Vercel (frontend), Render (backend), Neon (database) — all free tiers |

## Architecture

```text
Browser ─▶ Vercel (React SPA) ──HTTPS/REST──▶ Render (FastAPI)
                                                  │
                    ┌──────────── observer side ──┴── world side ───────────┐
                    │ detection · incidents ·        simulation · faults ·  │
                    │ investigation · public APIs    evaluation · benchmarks│
                    └───────────────────────┬───────────────────────────────┘
                                            ▼
                         Neon PostgreSQL  (public schema │ evaluation schema)
```

Details: [`context/architecture.md`](context/architecture.md) and [`context/system_design.md`](context/system_design.md).

## Repository layout

```text
.
├── RANOps_AI_PROJECT.md      # Project specification (source of truth)
├── requirement.md            # Requirements with stable IDs
├── context/                  # Engineering context used throughout development
│   ├── system_design.md
│   ├── architecture.md
│   ├── phasewise_roadmap.md
│   ├── deployment.md
│   ├── performance_review.md
│   └── benchmark.md
├── frontend/                 # React + Vite app            (Phase 0)
└── backend/                  # FastAPI service             (Phase 0)
```

## Getting started

Prerequisites: Git, Python 3.12, Node.js 24 LTS (22+ works), and optionally Docker Desktop — see [`requirement.md` §5](requirement.md#5-development-toolchain). No database is needed to start: `/health` and the whole UI shell work without one.

**Backend** (http://localhost:8000)

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Optional: copy `.env.example` to `backend/.env` and set `DATABASE_URL` / `DIRECT_DATABASE_URL` (a Neon `dev` branch works), then run `.venv\Scripts\alembic upgrade head`.

**Frontend** (http://localhost:5173)

```powershell
cd frontend
npm install
npm run dev
```

The frontend calls `http://localhost:8000` by default; override with `VITE_API_BASE_URL` in `frontend/.env.local`.

**Checks** (the same ones CI runs)

```powershell
cd backend;  .venv\Scripts\ruff check .;  .venv\Scripts\ruff format --check .;  .venv\Scripts\python -m pytest -q
cd frontend; npm run lint; npm run typecheck; npm run build
```

Deployment: [`context/deployment.md`](context/deployment.md).

## Documentation

| Document | Purpose |
|---|---|
| [Project specification](RANOps_AI_PROJECT.md) | Full scope, rules, and Definition of Done |
| [Requirements](requirement.md) | Functional / non-functional requirements and constraints |
| [System design](context/system_design.md) | Data model, algorithms, defaults, formulas, API contract |
| [Architecture](context/architecture.md) | Layers, module boundaries, request flows, decisions |
| [Roadmap](context/phasewise_roadmap.md) | Phase tasks, acceptance criteria, progress tracker |
| [Deployment](context/deployment.md) | Step-by-step free-tier deployment runbook |
| [Performance review](context/performance_review.md) | Budgets, measurement method, results log |
| [Benchmark](context/benchmark.md) | Suites, metrics, methodology, results log |

## Limitations

- Synthetic data only; results say nothing about real-network accuracy.
- Simplified RAN model — not a standards-complete 3GPP / O-RAN simulator.
- Free hosting sleeps when idle; the first request after a pause takes ~30–60 s.
- Ground truth is hidden from the inference pipeline and public API, not from people reading this source code.

## Author

**Pranjal Tyagi** — [GitHub](https://github.com/Pranjaltyagi76)
