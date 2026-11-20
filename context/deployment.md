# Deployment Runbook — RANOps AI (free tier only)

| | |
|---|---|
| Purpose | Step-by-step guide to deploy and operate the stack at zero cost, plus troubleshooting. |
| Source | [`../RANOps_AI_PROJECT.md` §17](../RANOps_AI_PROJECT.md) |
| Freshness | Free-tier facts checked **November 2026**. Re-check each provider's pricing/docs page before deploying and update the "Last verified" column. |

---

## 1. Free stack and limits

| Layer | Provider / plan | Key limits | Last verified |
|---|---|---|---|
| Frontend | Vercel Hobby | Personal, non-commercial use; static hosting | 2026-11 |
| Backend | Render free web service | 750 instance-hours/month per workspace; spins down after 15 min without inbound traffic (cold start ~30–60 s); ephemeral filesystem; ~512 MB RAM, low CPU (verify) | 2026-11 |
| Database | Neon free | 1 GB storage/project; 100 CU-hours/project/month; scale to zero; writes fail when storage is full (no overage billing) | 2026-11 |
| CI / cron | GitHub Actions | Free for public repos; scheduled workflows are disabled after 60 days without repository activity | 2026-11 |
| LLM (optional) | Gemini free tier / Groq free tier | Small, frequently changing daily quotas; check console | 2026-11 |

### Do not use
| Option | Why |
|---|---|
| Render free Postgres | Deleted 30 days after creation |
| Supabase free | Projects pause after inactivity |
| Hugging Face Docker Spaces | Reported as paid-only for new accounts |
| Fly.io / Railway / Cloud Run / Oracle | No lasting free tier or card required |
| Vercel Python functions (backend) | Scientific Python stack likely exceeds size limits; long jobs don't fit |

Fallback backend host if Render changes terms: Koyeb free instance (verify terms first). The Dockerfile keeps migration cheap.

---

## 2. One-time setup

### 2.1 Choose a region pair
Put Render and Neon in the same geography to minimise DB latency:

| Audience | Render region | Neon region |
|---|---|---|
| India / Asia reviewers | Singapore | AWS ap-southeast-1 (Singapore) |
| US reviewers | Virginia (or Ohio) | AWS us-east-1 (or us-east-2) |
| Europe reviewers | Frankfurt | AWS eu-central-1 |

### 2.2 Neon (database)
1. Sign up at neon.com (GitHub login, no card).
2. Create project `ranops-ai`, Postgres 16+, region from §2.1, database `ranops`.
3. Copy **two** connection strings from "Connect":
   - Pooled (host contains `-pooler`) → `DATABASE_URL`
   - Direct → `DIRECT_DATABASE_URL`
4. Convert both to SQLAlchemy form: `postgresql+psycopg://USER:PASSWORD@HOST/ranops?sslmode=require`.
5. Optional: create a `dev` branch for local development so production data stays clean.

### 2.3 Render (backend)
1. Sign up at render.com with GitHub (no card for free services).
2. New → Web Service → connect `Pranjaltyagi76/RanOpsAI`.
3. Settings:

| Field | Value |
|---|---|
| Name | `ranops-ai-api` |
| Region | from §2.1 |
| Branch | `main` |
| Root directory | `backend` |
| Runtime | Docker |
| Instance type | Free |
| Health check path | `/health` |
| Auto-deploy | On commit |

4. Start command (in Dockerfile `CMD` or Render override):

   ```text
   sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"
   ```

5. Environment variables — see §3 (backend block).

### 2.4 Vercel (frontend)
1. Sign up at vercel.com with GitHub (Hobby).
2. Add New → Project → import `Pranjaltyagi76/RanOpsAI`.
3. Settings: Root directory `frontend`, framework Vite, build `npm run build`, output `dist`, project name `ranops-ai` (gives `ranops-ai.vercel.app` if free).
4. Env var `VITE_API_BASE_URL` = Render URL (Production and Preview).
5. `frontend/vercel.json`:

   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```

6. After the first deploy, set Render `CORS_ORIGINS` to the exact production URL.

### 2.5 Seed the database (from your machine)

```powershell
cd backend
$env:DIRECT_DATABASE_URL = "<direct neon url>"
alembic upgrade head
python -m scripts.seed            # topologies, scenarios, runbooks
python -m scripts.seed --showcase # Phase 11: showcase run + benchmark
```

The seed script is idempotent (upserts by key/version).

---

## 3. Environment variables

```text
# ---------- Backend (Render) ----------
APP_ENV=production
DATABASE_URL=postgresql+psycopg://...-pooler.../ranops?sslmode=require
DIRECT_DATABASE_URL=postgresql+psycopg://.../ranops?sslmode=require
CORS_ORIGINS=https://ranops-ai.vercel.app
CORS_ORIGIN_REGEX=^https://ranops-ai(-[a-z0-9-]+)?\.vercel\.app$
LOG_LEVEL=INFO
DEMO_MODE=true
AI_PROVIDER=demo            # demo | gemini | groq
GEMINI_API_KEY=
GROQ_API_KEY=
AI_DAILY_CAP=20
ABSTAIN_THRESHOLD=0.5
MAX_RUN_POINTS=720
RUN_TTL_HOURS=24
MAX_VISITOR_RUNS=200
RATE_LIMIT_DEFAULT=120/minute
ADMIN_TOKEN=<long random string>

# ---------- Frontend (Vercel) ----------
VITE_API_BASE_URL=https://ranops-ai-api.onrender.com

# ---------- GitHub repository ----------
# Variables:  API_URL = https://ranops-ai-api.onrender.com
# Secrets:    ADMIN_TOKEN = <same as Render>
```

Generate `ADMIN_TOKEN` locally, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Never commit real values; keep `.env.example` in sync.

---

## 4. GitHub Actions workflows

Pin action versions to their current major release at implementation time.

### 4.1 `ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: ranops, POSTGRES_PASSWORD: ranops, POSTGRES_DB: ranops_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U ranops" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      APP_ENV: test
      DATABASE_URL: postgresql+psycopg://ranops:ranops@localhost:5432/ranops_test
      DIRECT_DATABASE_URL: postgresql+psycopg://ranops:ranops@localhost:5432/ranops_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip, cache-dependency-path: "backend/requirements*.txt" }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check . && ruff format --check .
      - run: alembic upgrade head
      - run: pytest -q

  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
```

### 4.2 `cleanup.yml`

```yaml
name: Cleanup expired runs
on:
  schedule: [{ cron: "17 3 * * *" }]   # daily 03:17 UTC
  workflow_dispatch:
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS --max-time 120 -X POST \
            -H "X-Admin-Token: ${{ secrets.ADMIN_TOKEN }}" \
            "${{ vars.API_URL }}/api/v1/admin/cleanup"
```

### 4.3 `keepwarm.yml` (optional)

```yaml
name: Keep backend warm
on:
  schedule: [{ cron: "*/14 * * * *" }]
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS --max-time 90 "${{ vars.API_URL }}/health"
```

Notes:
- Pings **only** `/health` (no DB) so Neon still scales to zero.
- Uses ~744 of Render's 750 free hours → only one free Render service in the workspace.
- GitHub cron is best-effort (runs may be delayed or skipped); UptimeRobot's free 5-minute monitor is an alternative.
- Scheduled workflows stop after 60 days of no repo activity — push something or re-enable.

---

## 5. Release procedure (every phase)

1. All tests green locally and in CI.
2. Merge/push to `main` → Vercel and Render auto-deploy.
3. Render logs: migration ran, app started, no errors.
4. Smoke test (clean browser / incognito):
   - [ ] Frontend loads; warm-up state appears then clears.
   - [ ] `GET {API}/health` → 200; `GET {API}/health/ready` → 200.
   - [ ] Phase's new workflow works end-to-end.
   - [ ] No CORS errors in the console.
   - [ ] Response bodies contain no hidden fields.
5. Record URLs, commit SHA, and measurements in the phase report ([`phasewise_roadmap.md`](phasewise_roadmap.md)) and [`performance_review.md`](performance_review.md).

### Rollback
- Render: Dashboard → service → Events → previous deploy → "Rollback".
- Vercel: Deployments → previous production deployment → "Promote to Production" / Instant Rollback.
- Database: prefer forward-fix migrations; only `alembic downgrade -1` if the migration is known to be reversible and data-safe. Neon branching can snapshot before risky migrations.

---

## 6. Budget monitoring (monthly)

| Check | Where | Threshold |
|---|---|---|
| DB storage | Neon console → project → Storage | < 300 MB (alert at 500 MB) |
| DB compute | Neon console → Usage | < 60 CU-hours by mid-month |
| Render hours | Render → Billing/usage | < 750 h |
| Backend memory | Render → Metrics | peak < 400 MB |
| AI usage | `/about` page or `ai_usage` table | ≤ `AI_DAILY_CAP` |

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| First request takes ~1 min | Render free instance was asleep | Expected; frontend shows warm-up state; optional keep-warm |
| CORS error in browser | `CORS_ORIGINS` missing exact URL, or preview URL not matching regex | Update env var; check scheme and no trailing slash |
| Deep link (e.g. `/incidents/123`) 404 on Vercel | Missing SPA rewrite | Add `frontend/vercel.json` |
| `prepared statement "…" already exists` / does not exist | PgBouncer transaction pooling with psycopg prepared statements | `connect_args={"prepare_threshold": None}` on pooled URL |
| Alembic hangs or fails on pooled URL | Migrations need a direct session | Use `DIRECT_DATABASE_URL` in `alembic/env.py` |
| `SSL connection is required` | Missing `sslmode=require` | Add to both URLs |
| Render deploy killed / restarts with exit 137 | Out of memory | Lazy-import pandas/sklearn/LangGraph; reduce Isolation Forest training size; check `performance_review.md` |
| Runs stuck in `running` | Instance slept/restarted mid-job | Startup recovery marks them failed; re-run |
| Writes fail with storage error | Neon 1 GB reached | Run cleanup; check for telemetry stored per point or benchmark telemetry persisted by mistake |
| Neon compute hours burning while idle | Something polls the DB (health check, keep-warm, frontend polling a DB endpoint) | Ensure `/health` has no DB; stop polling when no job is running |
| AI button disabled | Daily cap reached or provider not configured | Expected; demo provider still works |
| Scheduled workflows stopped | 60 days without repo activity | Re-enable in Actions tab |
