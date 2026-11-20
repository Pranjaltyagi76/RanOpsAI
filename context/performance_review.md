# Performance Review — RANOps AI

| | |
|---|---|
| Purpose | Performance and resource budgets that keep the app inside free tiers, how to measure them, and a log of real measurements per phase. |
| Rule | **Only record numbers you measured.** Leave "TBD" until then. Every entry names the commit SHA, environment, and command used. |
| Related | Budgets come from [`../requirement.md` §4](../requirement.md) and [`deployment.md` §6](deployment.md). |

---

## 1. Budgets

| ID | Area | Budget | Hard limit (why) | Measured in phase |
|---|---|---|---|---|
| PB-01 | Backend idle memory (RSS) | < 250 MB | ~512 MB Render free instance | 0 |
| PB-02 | Backend peak memory, full workflow | < 400 MB | ~512 MB (OOM kill) | 4, 7, 10 |
| PB-03 | App startup (process start → `/health` 200), local | < 10 s | Render cold start adds to this | 0 |
| PB-04 | Render cold start (first request after sleep) | observe only (~30–60 s expected) | platform-controlled | 0, 11 |
| PB-05 | Default run simulate + persist (`demo-medium`) | < 5 s on free instance | user waiting | 2 |
| PB-06 | Detection (stat + gap + iforest) on default run | < 8 s on free instance (excluding first iforest training) | user waiting | 4 |
| PB-07 | Isolation Forest first training | < 15 s on free instance | first detection after cold start | 4 |
| PB-08 | Deterministic investigation | < 2 s | user waiting | 6 |
| PB-09 | Benchmark `slice-v1` (30 cases) | < 3 min on free instance | job blocks the single job slot | 7 |
| PB-10 | Warm read endpoints p95 (server time, `X-Process-Time`) | < 300 ms | UX | 2, 10 |
| PB-11 | Telemetry chart response (gzip) | < 100 KB | bandwidth, UX | 2 |
| PB-12 | DB size per default `demo-medium` run | < 0.5 MB | Neon 1 GB | 2, 4 |
| PB-13 | Total DB size | < 300 MB | Neon 1 GB (writes fail when full) | monthly |
| PB-14 | Neon compute | < 60 CU-h by mid-month | 100 CU-h/month | monthly |
| PB-15 | Frontend initial JS (gzip) | < 300 KB | load time | 0, 9 |
| PB-16 | Frontend LCP (warm backend, desktop) | < 2.5 s | UX | 9 |

---

## 2. How to measure

### Backend memory and CPU in a free-instance-like container
```powershell
docker build -t ranops-api ./backend
docker run --rm -p 8000:8000 --memory=512m --cpus=0.1 --env-file backend/.env ranops-api
docker stats --no-stream            # in another terminal: MEM USAGE while exercising the workflow
```
`--cpus=0.1` approximates a low-CPU free instance; treat results as indicative, then confirm on Render Metrics.

### In-process peak memory
Log `resource.getrusage(resource.RUSAGE_SELF).ru_maxrss` (Linux, KB) at the end of each job.

### Timing
- Every response carries `X-Process-Time` (ms) and it is logged → compute p50/p95 from logs.
- Jobs log `stage`, duration, and series count.
- Quick check: `curl -s -o NUL -w "%{time_total}\n" <url>` (PowerShell: use `curl.exe`).

### Database size
```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
-- per run:
SELECT pg_size_pretty(sum(pg_column_size(t.*))::bigint) FROM telemetry_series t WHERE run_id = :run_id;
```

### Frontend
- `npm run build` prints chunk sizes (gzip); add `rollup-plugin-visualizer` temporarily if a chunk is large.
- Chrome DevTools → Lighthouse (desktop) on the Vercel URL with the backend warm.

---

## 3. Known risks and mitigations

| Risk | Mitigation |
|---|---|
| scikit-learn + NumPy + pandas + LangGraph imports push idle memory up | Lazy-import inside the functions that need them; avoid pandas in hot paths |
| Isolation Forest training on cold start | Small `max_samples=256`, 20 training runs, train lazily once per process |
| CPU-bound job blocks the event loop | Run in a worker thread; single job slot |
| Large telemetry payloads | Server-side downsampling + GZip |
| DB growth | Series arrays, no benchmark telemetry, TTL cleanup, `MAX_VISITOR_RUNS` |
| Neon never sleeping | `/health` without DB; frontend polls only while a job is active |
| Frontend bundle bloat (React Flow, Recharts) | Route-level `lazy()` code splitting |

---

## 4. Review checklist (run at the end of every phase)

- [ ] New code paths import heavy libraries lazily.
- [ ] No per-point DB rows; no N+1 queries (check SQL logs for loops).
- [ ] New list endpoints paginated; new telemetry endpoints downsample.
- [ ] Jobs release memory (no module-level caches of run data; only the iforest model is cached).
- [ ] Budgets touched by this phase measured and logged below.
- [ ] Regressions vs the previous entry explained or fixed.

---

## 5. Measurement log

| Date | Phase | Commit | Environment | Budget ID | Result | Pass? | Notes |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | TBD | — | No measurements yet (pre-Phase 0) |

Environment values: `local-docker-512m-0.1cpu`, `render-free`, `vercel`, `neon-free`.
