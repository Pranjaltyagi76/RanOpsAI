# RANOps AI — 5G Network Failure Diagnosis, Anomaly Detection & Reliability Testing Platform

> Independent portfolio project inspired by the telecommunications and Open RAN domain served by Airspan Networks. This is a simulation, not an official Airspan product; it does not connect to or control real Airspan equipment.
>
> Naming rule: "Airspan" appears only in this disclaimer and the README disclaimer. Do not use the Airspan name or logo in the repository name, app title, favicon, Vercel/Render subdomains, or package names. Use `ranops-ai` everywhere.

## 1. Overview

RANOps AI simulates a simplified 5G / Open RAN environment, generates synthetic network telemetry, injects controlled faults, detects anomalous behaviour, investigates incidents using topology and runbooks, and evaluates diagnosis quality against hidden scenario ground truth.

### Problem
Network operations teams must identify abnormal KPIs, determine affected components, investigate likely root causes, and decide what to inspect next. Threshold alerts alone often lack topology context and evidence-backed diagnosis.

### Product workflow
1. Select a simulated network topology.
2. Generate normal telemetry, inject a chosen fault, or launch a blind "Mystery incident".
3. Run statistical and ML anomaly detection.
4. Group related anomalies into incidents.
5. Investigate using telemetry, topology, and troubleshooting runbooks.
6. Produce a structured diagnosis with evidence and confidence.
7. Reveal evaluation scores against hidden ground truth.
8. Compare detector/agent versions in repeatable benchmarks.

### Goals
- Interactive simplified RAN topology.
- Deterministic synthetic telemetry and fault injection.
- Statistical and ML anomaly detection.
- Evidence-grounded incident investigation.
- Ground-truth-separated evaluation.
- Benchmarking, regression comparison, and reports.
- Public demo that works without an AI API key.
- **Zero cost:** the entire stack is built, tested, and deployed on free tiers only (see Section 17).

### Non-goals and safety boundaries
- No connection to real telecom equipment.
- No live network configuration or remediation.
- No claim of standards-complete 3GPP/O-RAN simulation.
- No production accuracy claims based on synthetic data.
- No execution of LLM-generated commands.
- No paid infrastructure, paid API plans, or services that require a payment card to function.
- No user accounts or login for the MVP (public demo with abuse limits instead; see Section 15).

## 2. Target Domain and Users

**Industry:** Telecommunications, 5G, Open RAN, network operations.

**Intended users:** Telecom/network engineering students, junior NOC engineers, ML engineers working with time series, and technical interviewers.

The application is an educational simulation and portfolio demonstration, not an operational network-management product.

## 3. Simulated Network Model

Model a small network with the following component types:

| Component | Role | Example metrics |
|---|---|---|
| UE group | Connected user devices | active UEs, throughput, latency |
| Cell | Logical radio coverage area | PRB utilization, RSRP, SINR, handover failures |
| RU | O-RAN Radio Unit | availability, transmit power, temperature |
| DU | O-RAN Distributed Unit | CPU, memory, processing delay |
| CU | O-RAN Central Unit | session load, CPU, signalling |
| Transport link | Connects network components; typed as **backhaul**, **midhaul**, or **fronthaul** | latency, packet loss, bandwidth utilization |
| Core endpoint | Simplified 5G core (upstream) endpoint | latency, availability, packet loss |

Transport link types (simplified, using O-RAN / 3GPP terminology):

| Link type | Connects | Interface (reference only) |
|---|---|---|
| Backhaul | CU ↔ Core | NG |
| Midhaul | DU ↔ CU | F1 |
| Fronthaul | RU ↔ DU | O-RAN 7.2x split (eCPRI) |

Transport links are modelled as components (with their own telemetry) so faults can be localized to a link, not only to the nodes it connects.

### Seeded topology A — `demo-small` (13 components)

```text
                 Core Network
                       |
              Backhaul link (NG)
                       |
                      CU
                       |
              Midhaul link (F1)
                       |
                      DU
                 /           \
   Fronthaul (7.2x)      Fronthaul (7.2x)
          |                      |
        RU-1                   RU-2
          |                      |
       Cell-1                 Cell-2
          |                      |
     UE Group 1             UE Group 2
```

### Seeded topology B — `demo-medium` (23 components)

Two DUs under one CU so that root-cause localization is non-trivial (a DU-level fault affects only its own cells; a CU/backhaul fault affects all cells).

```text
                      Core Network
                           |
                   Backhaul link (NG)
                           |
                          CU
                   /               \
          Midhaul (F1)          Midhaul (F1)
               |                      |
             DU-1                   DU-2
            /    \                 /    \
         RU-1    RU-2           RU-3    RU-4
          |       |              |       |
       Cell-1  Cell-2         Cell-3  Cell-4
          |       |              |       |
        UE-1    UE-2           UE-3    UE-4
```

Each DU–RU edge in topology B is a fronthaul link component (omitted from the diagram for readability).

Each component has a stable ID, name, type, status, metadata, and graph relationships. Use NetworkX for graph traversal and React Flow for visualization. Selecting a node should show its metadata and telemetry; incidents should highlight related nodes.

Topologies are created only by the seed script, not by public API calls.

## 4. Telemetry Simulation

Generate timestamped telemetry for each applicable component.

Suggested metrics:
- `cpu_utilization` (%)
- `memory_utilization` (%)
- `availability` (%)
- `latency_ms`
- `packet_loss_pct`
- `throughput_mbps`
- `active_ues`
- `prb_utilization_pct`
- `handover_failure_rate_pct`
- `rsrp_dbm`
- `sinr_db`
- `traffic_load_mbps`
- `processing_delay_ms` (DU)
- `tx_power_dbm` (RU)
- `temperature_c` (RU)
- `bandwidth_utilization_pct` (transport links)
- `active_sessions` (CU)

Each component type emits only its applicable metrics (roughly 4–8 per component). Define the mapping in one place (`metrics_by_component_type`).

Normal telemetry must include noise, periodic traffic patterns, gradual load changes, and harmless temporary spikes. Use different baselines for different component types. Do not generate perfectly flat time series.

Every simulation accepts a random seed. The same topology, scenario, simulator version, configuration, and seed must reproduce the same data, bit for bit.

### Simulation defaults

| Setting | Default | Hard cap |
|---|---|---|
| Sampling interval | 60 s (1 point per simulated minute) | fixed for MVP |
| Run length | 360 points (6 simulated hours) | `MAX_RUN_POINTS` = 720 |
| Baseline (fault-free) warm-up | first 180 points | ≥ detector minimum history window |
| Fault window | starts after warm-up; default 60 points | must end before run end |

Simulated time starts at a fixed epoch per run (for example `2026-01-01T00:00:00Z`) so the timestamps are deterministic too.

### Storage format (free-tier critical)

Do **not** store one database row per data point. Store one row per series:

```text
telemetry_series(run_id, component_id, metric_name, start_at, interval_seconds, values REAL[])
```

`values` is a float4 array; missing data points are stored as `NULL` elements.

Size estimate for one `demo-small` run: 13 components × ~6 metrics × 360 points ≈ 28k values ≈ 0.12 MB in array form, versus ~4–5 MB as one row per point (row overhead + index). This keeps the database well inside Neon's free 1 GB.

**Benchmark runs do not persist telemetry.** Because the simulator is deterministic, the benchmark service regenerates telemetry in memory from (topology, scenario, simulator version, configuration, seed), runs detection/investigation/evaluation, and stores only the results.

The telemetry API may still return point-form JSON (timestamp/value pairs) to the frontend; the compact format is a storage concern only.

PostgreSQL is sufficient; do not add a separate time-series database.

## 5. Fault Injection Engine

Allow a user to choose scenario, target component, severity, duration, and random seed — or launch a **Mystery incident**, where the server picks the scenario, target, severity, and seed and hides them until evaluation.

Required scenarios:

| Fault | Target | Injection | Expected symptoms |
|---|---|---|---|
| Backhaul degradation | Backhaul link (midhaul optional variant) | Raise transport latency and packet loss | latency/loss rise on the link and downstream; throughput may fall |
| Cell congestion | Cell | Raise traffic and PRB utilization | PRB usage rises; user throughput may fall |
| Radio Unit failure | RU | Reduce RU availability or stop its telemetry | affected cell availability/throughput fall; RU series may go missing |
| Handover failure spike | Cell | Raise handover failure rate | handover KPI rises |
| Radio interference | Cell | Reduce SINR and throughput | signal quality and throughput degrade |
| Traffic surge | UE group / cell | Increase UE count and offered traffic | utilization rises, possibly without hardware fault |
| DU saturation | DU | Raise DU CPU and processing delay | DU load and connected-cell latency rise |
| Cell outage | Cell | Mark a cell unavailable | cell availability and traffic drop |
| KPI drift | Any applicable metric | Gradually shift a metric | slow deviation from baseline |
| Normal variation | Any | Inject harmless spike or load fluctuation | anomaly-like behaviour without a fault |

Each scenario definition has two parts:
- **Public part** (shown in the scenario library): ID, name, fault type, description, severity options, target requirements, scenario version.
- **Hidden part** (evaluation-only): injection parameters, hidden root cause, expected affected components, expected symptoms, and expected investigative checks.

Faults must alter telemetry, not directly dictate detector output. Store ground truth **and each run's fault configuration** (scenario ID, target, severity, injection parameters) separately from inference data (see Section 8). Include normal-control scenarios. Start with one fault per run; support overlapping faults only after the single-fault pipeline is reliable.

## 6. Anomaly Detection

Implement three detectors.

### A. Rolling statistical detector
- Rolling mean and standard deviation, or robust median/MAD.
- Configurable threshold.
- Minimum history window.
- Persistence rule to reduce one-point false alarms.

Example:

```text
z = (current_value - rolling_mean) / rolling_standard_deviation
```

Flag a metric when the configured threshold is exceeded for the required consecutive observations. Handle zero variance and missing data safely.

### B. Isolation Forest
Use scikit-learn Isolation Forest for multivariate anomaly detection. Candidate features include CPU, memory, latency, packet loss, throughput, PRB utilization, UE count, SINR, and handover failure rate.

**Training data:** train only on normal-control runs generated from a dedicated **training seed range** that never overlaps benchmark or showcase seeds:

| Seed range | Purpose |
|---|---|
| 1–999 | Benchmark suites |
| 1000–1999 | Isolation Forest training (normal-control only) |
| 2000–2999 | Seeded showcase runs |
| 10000+ | Visitor runs (random) |

**No model files on disk:** the free backend host has an ephemeral filesystem. Retrain deterministically (fixed `random_state`, fixed training seeds) on first use, cache the fitted model in memory, and persist only the detector version, configuration, training seed list, and a hash of the training data. Training must stay small enough to finish in a few seconds on a low-CPU instance.

Return anomaly scores; do not describe an anomaly score as the probability of a particular fault.

### C. Missing-telemetry (data-gap) detector
Flag a series when `N` or more consecutive expected points are missing (default `N = 3`). This is required so that "RU failure — stop telemetry" is detectable; the other detectors must skip missing points rather than treat them as zero.

### Detection result
Include run ID, component ID, metric, time window, observed value, baseline, score, detector version, threshold, severity estimate, and a concise deterministic explanation.

### Alert grouping
Group related detections by component/dependency and time window. Do not create one incident per anomalous data point.

### Detection evaluation
Measure precision, recall, F1, false-positive rate, false negatives, detection delay, and alert count per run.

Matching rules (default; record them in the benchmark configuration):
- **True positive:** a detection whose component is in the expected affected set and whose time window overlaps `[fault_start, fault_end + tolerance]`, with `tolerance` = 10 points.
- **False positive:** any detection on a normal-control run, or any detection outside the expected components or outside the tolerated window.
- **Fault detected (recall):** at least one true-positive detection exists for the run.
- **Detection delay:** timestamp of the first true positive minus `fault_start`, in points and minutes.
- **False-positive rate:** false-positive detections per 100 series-hours on normal-control runs.

## 7. Incident Investigation

Use a structured workflow that reasons only over observable evidence.

```text
Load Incident
   -> Summarize Telemetry
   -> Inspect Topology
   -> Retrieve Runbook
   -> Generate Hypotheses
   -> Verify Evidence
   -> Check Confidence / Abstain
   -> Format Diagnosis
```

Suggested LangGraph nodes:
1. `load_incident`
2. `summarize_telemetry`
3. `inspect_topology`
4. `retrieve_runbook`
5. `generate_hypotheses`
6. `verify_evidence`
7. `check_confidence`
8. `format_diagnosis`

Import LangGraph lazily (inside the investigation service) to keep backend startup memory low.

### Investigation input whitelist
The investigation context is built **only** from: the incident, its detections, the run's telemetry series, the topology graph, and runbooks. It must never load simulation-run labels, scenario IDs, fault configuration, or anything from the evaluation schema. Incident titles are generated from detections (for example "Latency anomaly on LINK-BH-01 + 2 related components"), never from scenario names.

Use bounded retries and a clear failure path. Every claim must be grounded in telemetry or computed aggregates. It must return alternatives and abstain when evidence is insufficient. Do not expose private model chain-of-thought; show concise conclusions and evidence only.

### Confidence and abstention
`confidence` is a deterministic **evidence score in [0, 1]**, not a probability. Compute it from:
- the fraction of the runbook's confirmation checks that the evidence satisfies,
- the margin between the primary hypothesis and the best alternative,
- data completeness for the involved series.

Abstain when `confidence < ABSTAIN_THRESHOLD` (default 0.5) or when the margin over the best alternative is < 0.1. Document the formula and its version as part of the agent version.

Example structured response:

```json
{
  "incident_id": "INC-0001",
  "primary_hypothesis": "transport_link_degradation",
  "affected_components": ["LINK-BH-01", "CU-01"],
  "confidence": 0.82,
  "evidence": [
    {
      "component_id": "LINK-BH-01",
      "metric": "latency_ms",
      "observed_value": 85.0,
      "baseline_value": 12.0,
      "observation": "Latency increased above baseline"
    }
  ],
  "alternative_hypotheses": ["upstream_congestion"],
  "recommended_checks": [
    "Inspect transport-link packet loss",
    "Compare latency at adjacent components"
  ],
  "abstained": false,
  "provider": "demo",
  "is_fallback": false
}
```

Values are illustrative only. Populate them from actual stored observations.

### Runbooks
Create versioned troubleshooting runbooks for each fault type. Each includes symptoms, components to inspect, relevant metrics, confirmation checks, alternative explanations, and safe next investigative checks. Keyword retrieval is sufficient for the MVP; vector retrieval (pgvector, available free on Neon) is optional.

## 8. Ground Truth and Evaluation Integrity

This is a core architecture requirement.

- Store ground truth and each run's fault configuration in a separate PostgreSQL schema, `evaluation`, accessed only through `app/services/evaluation/repository.py`.
- The public `simulation_runs` record stores no scenario ID, target, or fault parameters.
- Do not include hidden labels in telemetry responses or agent state.
- Do not put true fault names in prompts.
- Only the evaluator may read hidden labels.
- Reveal scores only after inference has completed.

Enforcement (tested, not just documented):
- **Import boundary test:** a pytest walks imports and enforces the world/observer split. Observer modules (`detection`, `incidents`, `investigation`, `runbooks`, `topology`) and the public `app/api` routers must not import `app.services.evaluation`, `app.services.faults`, or `app.models.evaluation`. `simulation` may import only the write-only `app.services.evaluation.writer`, never the evaluation repository. (Full table: `context/architecture.md` §3.)
- **Leak test:** for every scenario, serialize the full investigation context/state and assert it contains none of that run's scenario ID, fault type, root-cause label, or injection parameters.
- **API test:** public scenario, run, telemetry, incident, and investigation responses contain no hidden fields.
- Optional hardening: a separate Postgres role with no privileges on the `evaluation` schema for the inference code path.

Score:
- Root-cause top-1 and top-3 accuracy.
- Affected-component accuracy.
- Evidence precision/recall.
- Recommended-check relevance using predefined expected checks.
- Policy compliance.
- Abstention quality.

Use deterministic scoring as the primary benchmark. An LLM judge may be supplementary, never the sole source of truth.

Every benchmark records scenario-suite version, simulator version, detector version/configuration, agent/prompt version, model/provider if used, seeds, matching rules, timestamps, and results.

## 9. Main Application Features

All pages must handle the backend cold start: on first load the frontend calls `/health` and shows a "Waking up the backend (free hosting, ~30–60 s)…" state instead of a generic error.

### Dashboard
Show simulation count, active incidents, simulated network availability, average latency, packet loss, anomaly count, latest runs, and recent high-severity incidents. Clearly label demo data. Feature the seeded showcase run so first-time visitors see results immediately.

### Network topology
Interactive graph, component details, type/status filters, incident highlighting, and topology legend (including backhaul/midhaul/fronthaul link types).

### Telemetry explorer
Filter by run, component, metric, and time range. Plot time series, anomaly markers, data-gap markers, and baseline/threshold overlays. Request downsampled data (`max_points`) for charts.

### Scenario library
List scenarios with descriptions, severity, fault type, and target requirements. Do not reveal hidden ground truth before evaluation.

### Simulation launcher
Choose topology, scenario, target, severity, duration (capped by `MAX_RUN_POINTS`), and seed; or click **Mystery incident**. Start a run and poll its status. Show the visitor-run expiry time.

### Incidents
List/filter incidents by severity, status, component, and time. Show timeline, evidence, affected components, and investigation state.

### Investigation detail
Show incident summary, anomaly timeline, charts, topology context, diagnosis, evidence, alternatives, recommended checks, confidence, and abstention. Offer "Investigate (demo, deterministic)" by default and an optional "Investigate with AI" button when an AI provider is configured and the daily cap is not exhausted. Reveal the ground-truth score only after evaluation.

### Benchmarks
Run a fixed scenario suite against selected detector/agent versions. Compare accuracy, false positives, detection delay, evidence metrics, and policy compliance. Highlight regressions. Show the seeded showcase benchmark by default.

### Reports
Generate HTML reports with a print stylesheet so users can export PDF with the browser's "Print → Save as PDF". No server-side PDF rendering (too heavy for the free backend). Include run configuration, scenario summary (revealed only after evaluation), detection results, diagnosis, evaluation scores, version details, and limitations.

### Settings / About
Read-only view of the active AI provider (demo or LLM), remaining AI requests today, detector thresholds, demo-mode indicator, free-hosting notice, and application information. Detector thresholds are changed per run or per benchmark, not globally by visitors. Never expose secrets in the frontend.

## 10. Technology Stack

All tools below are free and open source, or used on a free tier.

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui or equivalent component library
- React Router
- TanStack Query
- Recharts
- React Flow

### Backend
- Python 3.12 (pinned in `.python-version` and on the host)
- FastAPI and Pydantic
- SQLAlchemy 2 and Alembic
- psycopg 3 (PostgreSQL driver)
- PostgreSQL (Neon free tier)
- NumPy (Pandas only where it clearly helps; import lazily)
- scikit-learn
- NetworkX
- LangGraph (investigation workflow; import lazily)
- slowapi (in-memory rate limiting)
- pytest
- Optional: `uv` for dependency management

### Background work
No Redis and no separate worker process (both are paid on free hosts). Long tasks (simulation, detection, benchmarks) run with FastAPI `BackgroundTasks` in the web process, at most one job at a time (in-process semaphore), with status persisted in the database and polled by the frontend.

### Optional
- An LLM provider on a free tier for investigation (Gemini free tier; Groq free tier as an alternative). Never required.
- pgvector for semantic runbook retrieval.

### CI
- GitHub Actions (free for public repositories).

Use Node only for frontend tooling; no Node backend and no Streamlit.

## 11. Architecture

```text
Browser
   |
Vercel (static React + Vite SPA)
   | HTTPS / REST (CORS)
   v
Render free web service: FastAPI backend
   |
  +-----+-----------+----------------+
  |                 |                |
Topology Service  Simulation      Incident Service
  |               Service             |
NetworkX       Telemetry + Faults  Alert Grouping
                  |
           Telemetry Store (series arrays)
                  |
          Detection Service
                  |
         Investigation Service ---- (optional) free-tier LLM API
                  |
             LangGraph
                  |
          Runbook / Evidence
                  |
   ======== evaluation boundary ========
                  |
          Evaluation Service  (only reader of `evaluation` schema)
                  |
          Benchmark Service
                  |
     Neon PostgreSQL (public schema + evaluation schema)
```

Keep business logic in service modules, not route handlers. Use Pydantic request/response schemas and SQLAlchemy models.

## 12. Database Design

Use PostgreSQL, SQLAlchemy, and Alembic. Two schemas: `public` (inference/app data) and `evaluation` (hidden data).

### `public` schema
- `topologies`: id, key, name, description, version, created_at.
- `network_components`: id, topology_id, component_key, name, component_type, link_type (nullable: backhaul/midhaul/fronthaul), metadata JSONB.
- `topology_edges`: id, topology_id, source_component_id, target_component_id, metadata JSONB.
- `scenario_definitions`: id, name, fault_type, description, severity_options JSONB, target_requirements JSONB, scenario_version. (Public part only.)
- `simulation_runs`: id, topology_id, label, is_mystery, is_showcase, status, stage, random_seed, simulator_version, run_parameters JSONB (duration, interval only — nothing revealing the fault), error, created_at, started_at, completed_at, expires_at.
- `telemetry_series`: id, run_id, component_id, metric_name, start_at, interval_seconds, values REAL[]. Unique on `(run_id, component_id, metric_name)`.
- `detection_results`: id, run_id, component_id, metric_name, detector_name, detector_version, window_start, window_end, anomaly_score, is_anomaly, evidence JSONB.
- `incidents`: id, run_id, title, severity, status, started_at, ended_at, component_ids JSONB, summary.
- `investigations`: id, incident_id, agent_version, provider, is_fallback, diagnosis JSONB, confidence, abstained, created_at.
- `evaluation_results`: id, run_id, investigation_id, benchmark_version, metrics JSONB, created_at. (Scores only, written by the evaluator after inference.)
- `benchmark_runs`: id, name, scenario_suite_version, configuration JSONB, status, aggregate_metrics JSONB, is_showcase, created_at, completed_at.
- `benchmark_case_results`: id, benchmark_id, scenario_id, seed, detector_version, agent_version, metrics JSONB. (No telemetry stored.)
- `runbooks`: id, fault_type, title, content, version, updated_at.
- `ai_usage`: usage_date, provider, request_count. (Enforces `AI_DAILY_CAP`.)

`simulation_runs.label` is shown to the user (for example "Cell congestion · CELL-02" or "Mystery incident"), but the investigation service must never read it (Section 7 whitelist).

### `evaluation` schema (evaluator-only)
- `evaluation.run_fault_configs`: run_id, scenario_id, target_component_key, severity, fault_start, fault_end, injection_parameters JSONB.
- `evaluation.scenario_hidden`: scenario_id, injection_template JSONB, root_cause, expected_symptoms JSONB, expected_checks JSONB.
- `evaluation.scenario_ground_truth`: id, scenario_id, run_id, root_cause, affected_component_keys JSONB, expected_symptoms JSONB, expected_checks JSONB.

### Indexes
- `telemetry_series (run_id, component_id, metric_name)` unique.
- `detection_results (run_id, component_id)`.
- `incidents (run_id)`, `incidents (severity, status)`.
- `simulation_runs (expires_at)` for cleanup.
- `benchmark_case_results (benchmark_id)`.

Add appropriate foreign keys with `ON DELETE CASCADE` from run-owned tables to `simulation_runs` so cleanup is a single delete. Keep credentials out of database records.

## 13. REST API

General rules:
- List endpoints are paginated: `?limit=` (default 20, max 100) and `?offset=`.
- Responses are gzip-compressed (`GZipMiddleware`).
- Write endpoints are rate-limited per IP (Section 15).

### Health
```text
GET    /health               # liveness only — must NOT touch the database
GET    /health/ready         # checks database connectivity
```

### Topology (read-only; topologies come from the seed script)
```text
GET    /api/v1/topologies
GET    /api/v1/topologies/{topology_id}
GET    /api/v1/topologies/{topology_id}/graph
GET    /api/v1/components/{component_id}
```

### Scenarios and simulations
```text
GET    /api/v1/scenarios
GET    /api/v1/scenarios/{scenario_id}
POST   /api/v1/simulations                 # body: topology, scenario, target, severity, duration, seed | {"mystery": true}
GET    /api/v1/simulations
GET    /api/v1/simulations/{run_id}
GET    /api/v1/simulations/{run_id}/status
GET    /api/v1/simulations/{run_id}/telemetry?component_id=&metric=&from=&to=&max_points=500
```

Telemetry is downsampled server-side when the series is longer than `max_points` (bucket min/mean/max), to keep payloads small.

### Detection and incidents
```text
GET    /api/v1/detectors
POST   /api/v1/simulations/{run_id}/detect
GET    /api/v1/simulations/{run_id}/detections
GET    /api/v1/incidents
GET    /api/v1/incidents/{incident_id}
PATCH  /api/v1/incidents/{incident_id}
```

### Investigation, runbooks, and evaluation
```text
POST   /api/v1/incidents/{incident_id}/investigate     # body: {"provider": "demo" | "llm"}
GET    /api/v1/incidents/{incident_id}/investigation
GET    /api/v1/runbooks
GET    /api/v1/runbooks/{runbook_id}
POST   /api/v1/simulations/{run_id}/evaluate
GET    /api/v1/simulations/{run_id}/evaluation          # 404 until evaluation has run
```

### Benchmarks and reports
```text
POST   /api/v1/benchmarks
GET    /api/v1/benchmarks
GET    /api/v1/benchmarks/{benchmark_id}
GET    /api/v1/benchmarks/{benchmark_id}/compare
GET    /api/v1/reports/incidents/{incident_id}          # HTML
GET    /api/v1/reports/benchmarks/{benchmark_id}        # HTML
```

### Admin (not used by the frontend)
```text
POST   /api/v1/admin/cleanup        # requires header X-Admin-Token: $ADMIN_TOKEN; deletes expired runs
```

Public scenario, simulation, telemetry, incident, and investigation endpoints must never return hidden ground-truth labels or fault configuration. Enforce evaluator access at the service boundary, not merely by hiding fields in the frontend.

## 14. Demo Mode and AI Provider Design

The product must work without any API key. **Demo mode is the default** (`AI_PROVIDER=demo`).

Demo mode includes:
- Pre-seeded topologies, scenarios, and runbooks.
- A pre-computed **showcase**: one completed backhaul-degradation run on `demo-medium` with incident, investigation, evaluation, report, and one completed benchmark. Showcase records are immutable (`is_showcase = true`, never expire).
- Deterministic telemetry and fault injection.
- Working statistical, Isolation Forest, and data-gap detectors.
- Deterministic rule-based investigation.
- Evaluation, benchmarks, and sample reports.

Define an investigation provider interface. Implement:
- `DemoInvestigationProvider`: deterministic, no API key. Always available.
- `GeminiInvestigationProvider`: optional, uses the Gemini API **free tier**.
- (Optional) `GroqInvestigationProvider`: alternative free-tier provider behind the same interface.

LLM usage rules (free-tier protection):
- The LLM is called only when a user explicitly clicks "Investigate with AI"; it is never called automatically, by benchmarks, or by the showcase.
- Enforce a global `AI_DAILY_CAP` (default 20 requests/day) via the `ai_usage` table, plus a per-IP rate limit. When exhausted, the button is disabled with an explanation and the demo provider is used.
- Cache: one LLM investigation per incident and agent version; repeat requests return the stored result.
- Free-tier LLM quotas changed several times during 2026 and can be very small (tens of requests per day). Check the current limits in the provider's console before enabling.
- Free-tier providers may use submitted data for model improvement. Send only synthetic data; never send secrets or personal data.

If an AI call fails, times out, or exceeds quota, fall back to the demo provider and label the result as fallback output (`is_fallback = true`). Keep API keys server-side. Never make core workflows depend on any external model.

## 15. Security and Reliability

- Validate request payloads and enforce request-size limits (for example 64 KB bodies).
- Store secrets in environment variables.
- Keep ground truth isolated from inference (Section 8).
- Never connect to or control live telecom equipment.
- Never execute shell or network commands generated by an LLM.
- Use ORM/parameterized queries.
- Add timeouts (10–20 s) and bounded retries for provider calls.
- Log without leaking credentials.
- Label all generated data as synthetic.
- Distinguish anomaly detection from root-cause hypotheses and verified evaluation.

### Public-demo abuse limits (no login)
- Rate limits per IP with slowapi (in-memory; acceptable on a single instance):
  - `POST /simulations`: 10 per hour
  - `POST /benchmarks`: 3 per hour
  - `POST /investigate` with LLM: 5 per hour (plus the global daily cap)
  - all other requests: 120 per minute
- Visitor runs expire after `RUN_TTL_HOURS` (default 24) and are deleted by cleanup.
- At most `MAX_VISITOR_RUNS` (default 200) live visitor runs; when full, new runs are rejected with a friendly message.
- Benchmark suites are fixed and small (≤ 30 cases) so they finish on a low-CPU instance.
- Showcase records cannot be modified or deleted through the API.
- Admin endpoints require `ADMIN_TOKEN`.

### Reliability on free hosting
- Only one background job runs at a time; further jobs wait in `queued`.
- On startup, mark any run or benchmark left in `running`/`queued` as `failed` with "interrupted by server restart" (free instances sleep and restart).
- On startup, delete expired visitor runs (in addition to the scheduled cleanup).
- Small database pool (`pool_size=3`, `max_overflow=2`, `pool_pre_ping=True`) for Neon.

## 16. Testing Strategy

### Unit tests
- Same seed produces identical telemetry.
- Each fault changes its intended metrics.
- Normal controls do not contain hidden fault labels in inference data.
- Detectors handle missing values and zero variance; the data-gap detector flags stopped telemetry.
- Topology traversal returns expected connected components for both seeded topologies.
- Incident grouping merges related detections.
- Evaluator metrics and detection matching rules are correct.
- Confidence/abstention formula behaves as documented.
- Public APIs do not expose ground truth or fault configuration.
- **Import boundary test** and **leak test** (Section 8).
- `/health` does not open a database connection.

### Integration tests
- Seed topology -> simulate -> persist telemetry series.
- Regenerated telemetry equals stored telemetry for the same inputs.
- Inject fault -> detect -> create incident.
- Investigate -> store structured diagnosis.
- Evaluate -> produce deterministic scores.
- Benchmark -> compare versions (without persisting telemetry).
- Generate incident report.
- Startup recovery marks interrupted jobs as failed; cleanup deletes expired runs and keeps showcase runs.
- AI daily cap and fallback labelling.

### Resource tests (free-tier budget)
- Backend container runs the full workflow with `docker run --memory=512m` without being OOM-killed; record peak memory (target < 400 MB).
- One default run on `demo-medium` stores < 0.5 MB in the database.

### End-to-end acceptance test
A reviewer can open the deployed app (including a cold start), select the demo topology, run a backhaul-degradation scenario, inspect telemetry, run detection, open the incident, investigate it, reveal evaluation scores, view a benchmark, and export a report (browser print to PDF) without an API key.

## 17. Free-Tier Deployment

Free-tier quotas and policies change. The figures below were checked in November 2026; re-verify on each provider's pricing page before deploying.

### Chosen free stack

| Layer | Provider | Free-tier facts that shape the design |
|---|---|---|
| Frontend | **Vercel Hobby** | Free for personal, non-commercial projects (a portfolio qualifies). Static SPA hosting. |
| Backend | **Render free web service** | 750 instance hours/month per workspace. Spins down after 15 minutes without inbound traffic; the next request waits for a cold start (~30–60 s). Ephemeral filesystem (wiped on redeploy/restart/spin-down). Small instance (~512 MB RAM; verify at signup). |
| Database | **Neon free** | 1 GB storage per project, 100 compute-unit-hours per project per month, scales to zero when idle. No overage billing; writes fail when storage is full. |
| CI / cron | **GitHub Actions** | Free for public repositories. |
| LLM (optional) | Gemini free tier (or Groq free tier) | Small, changing daily limits. Never required. |

### Do not use
- **Render free Postgres** — free databases are deleted 30 days after creation.
- **Supabase free** for this project — free projects pause after a period of inactivity, which breaks a portfolio demo that may sit idle.
- **Hugging Face Docker Spaces** — Docker Spaces are reported to require a paid plan for new accounts.
- **Fly.io, Railway, Google Cloud Run, Oracle Cloud** — no lasting free tier for new accounts, or a payment card is required.
- **Vercel Python functions for the backend** — numpy + scipy + scikit-learn + pandas are likely to exceed the function size limit, and long simulations do not fit serverless execution.

Fallback if Render's free plan changes: Koyeb free instance (verify its current terms first). Keep the backend a plain Dockerfile so it can move between hosts.

### Frontend (Vercel)
- Root directory `frontend/`, framework preset Vite, build `npm run build`, output `dist`.
- `frontend/vercel.json` with SPA rewrites so React Router deep links do not 404:

  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

- Environment variable `VITE_API_BASE_URL` = the Render backend URL.
- Auto-deploy from `main`; preview deployments for pull requests.

### Backend (Render)
- Service name `ranops-ai-api`, runtime Docker (or native Python 3.12), plan Free, region nearest to the Neon region.
- Health check path: `/health`.
- Start command runs migrations first, because pre-deploy commands may not be available on free instances:

  ```text
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```

- Alembic uses `DIRECT_DATABASE_URL`; the app uses the pooled `DATABASE_URL`.
- CORS: allow the production Vercel URL exactly (`CORS_ORIGINS`) plus Vercel preview URLs by regex (`CORS_ORIGIN_REGEX`, for example `^https://ranops-ai(-[a-z0-9-]+)?\.vercel\.app$`).
- Nothing is written to local disk except temporary files.

### Database (Neon)
- One project, one database, region close to Render.
- Two connection strings:
  - `DATABASE_URL` — pooled host (contains `-pooler`), used by the app. With PgBouncer transaction pooling, disable psycopg prepared statements (`prepare_threshold=None` in connect args).
  - `DIRECT_DATABASE_URL` — direct host, used by Alembic migrations and the seed script.
- Both use the `postgresql+psycopg://` scheme and `sslmode=require`.
- Seeding: run the seed script **from your own machine** (`python -m scripts.seed` with `DIRECT_DATABASE_URL`). It creates topologies, scenarios, runbooks, and the pre-computed showcase run and benchmark, so heavy computation never runs on the free backend.

### Keep-warm and scheduled jobs (GitHub Actions)
- `.github/workflows/ci.yml` — on push/PR: backend lint + pytest (against a Postgres service container), frontend lint + type-check + build.
- `.github/workflows/cleanup.yml` — daily: `POST /api/v1/admin/cleanup` with the `ADMIN_TOKEN` repository secret.
- `.github/workflows/keepwarm.yml` (optional) — every 14 minutes: `GET /health`. Reduces cold starts. Uses nearly all of Render's 750 monthly hours, so this works only while you run a single free Render service. GitHub cron timing is best-effort and may be delayed; UptimeRobot's free monitor is an alternative.
- **The keep-warm ping must hit `/health`, which never touches the database.** If it woke Neon every 14 minutes, the database would never scale to zero and would use up its 100 compute-unit-hours mid-month (at the 0.25 CU minimum that is ~400 hours, but a month has ~744).

### Free-tier budget

| Resource | Free limit | Project budget |
|---|---|---|
| Neon storage | 1 GB | < 300 MB: seed + showcase + ≤ 200 visitor runs (~0.5 MB each) + results |
| Neon compute | 100 CU-hours/month | Wakes only on real user requests; scales to zero when idle |
| Render hours | 750 hours/month | One free service only |
| Render memory | ~512 MB | Peak < 400 MB, measured in the resource test |
| LLM requests | provider free tier | `AI_DAILY_CAP` = 20 by default |
| Vercel | Hobby limits | Static assets only |

### Required environment variables

```text
# Backend (Render) — never commit real values
APP_ENV=production
DATABASE_URL=postgresql+psycopg://...-pooler.../ranops?sslmode=require
DIRECT_DATABASE_URL=postgresql+psycopg://.../ranops?sslmode=require
CORS_ORIGINS=https://ranops-ai.vercel.app
CORS_ORIGIN_REGEX=^https://ranops-ai(-[a-z0-9-]+)?\.vercel\.app$
LOG_LEVEL=INFO
DEMO_MODE=true
AI_PROVIDER=demo            # demo | gemini | groq
GEMINI_API_KEY=             # optional
GROQ_API_KEY=               # optional
AI_DAILY_CAP=20
ABSTAIN_THRESHOLD=0.5
MAX_RUN_POINTS=720
RUN_TTL_HOURS=24
MAX_VISITOR_RUNS=200
RATE_LIMIT_DEFAULT=120/minute
ADMIN_TOKEN=                # long random string

# Frontend (Vercel)
VITE_API_BASE_URL=https://ranops-ai-api.onrender.com
```

Maintain these in `.env.example` with placeholder values. Do not commit `.env`. API keys are optional; the app must start and work with all of them empty.

### Deployment acceptance
- Public frontend and backend URLs work, including after a cold start (frontend shows the waking-up state).
- Database migrations and seed (including the showcase) succeed.
- Full simulation-to-report workflow works in a clean browser.
- Demo mode works without an AI key.
- Secrets, fault configuration, and ground-truth labels are not exposed.
- CORS works for production and preview URLs; logs and error handling are verified.
- Rate limits, run expiry, and cleanup work.
- Free-tier budget is respected: memory measured, database size checked in the Neon console, Neon scales to zero when the app is idle.
- Nothing in the stack requires a payment method.

## 18. Suggested Repository Structure

```text
ranops-ai/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cleanup.yml
│       └── keepwarm.yml
├── frontend/
│   ├── vercel.json
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── dashboard/
│       │   ├── topology/
│       │   ├── telemetry/
│       │   ├── scenarios/
│       │   ├── simulations/
│       │   ├── incidents/
│       │   ├── benchmarks/
│       │   └── reports/
│       ├── hooks/
│       ├── lib/
│       ├── routes/
│       └── types/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   │       ├── topology/
│   │       ├── simulation/
│   │       ├── faults/
│   │       ├── detection/
│   │       ├── incidents/
│   │       ├── investigation/
│   │       ├── runbooks/
│   │       ├── evaluation/      # only module allowed to access the `evaluation` schema
│   │       ├── benchmarks/
│   │       ├── reports/         # Jinja2 HTML reports
│   │       └── jobs/            # in-process background jobs, startup recovery, cleanup
│   ├── alembic/
│   ├── scripts/
│   │   └── seed.py
│   ├── tests/
│   ├── .python-version
│   ├── Dockerfile
│   └── requirements.txt
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

## 19. Development Roadmap

Build in phases. Do not start with the LLM agent or a large dashboard. Make simulation and evaluation correct first. **Deploy early and keep deploying:** after Phase 0, every phase that reaches acceptance is merged to `main`, which auto-deploys to Vercel and Render, and is checked on the public URLs.

Build a **thin end-to-end slice first** (3 scenarios through simulation → detection → incident → investigation → evaluation → benchmark), then widen to all ten scenarios.

### Phase 0 — Foundation and skeleton deployment
- Create repository (`ranops-ai`) and frontend/backend folders.
- Configure React + Vite + TypeScript and FastAPI (Python 3.12).
- Add environment configuration, logging, formatting, linting, and tests.
- Implement `/health` (no DB) and `/health/ready` (DB check).
- Connect frontend to backend health endpoint, including the "waking up" state.
- Add GitHub Actions CI.
- Create the Neon project, Render service, and Vercel project; deploy the skeleton; configure CORS and environment variables.
- Measure backend memory with `docker run --memory=512m`.

**Acceptance:** Both apps run locally and in production on free tiers; the deployed frontend calls the deployed backend; CI passes; no payment method was required.

### Phase 1 — Data model and topology
- Create SQLAlchemy models and Alembic migrations (`public` and `evaluation` schemas).
- Write the seed script; seed `demo-small` and `demo-medium`.
- Implement topology/component APIs and NetworkX graph traversal.
- Build interactive topology page.

**Acceptance:** User can view both graphs and inspect components on the deployed app.

### Phase 2 — Telemetry simulator
- Define metrics per component type.
- Implement deterministic normal telemetry with the default settings (Section 4).
- Persist telemetry as compact series and the simulation lifecycle as background jobs.
- Build telemetry API (with downsampling) and charts.

**Acceptance:** User can start a normal run and explore time series; same seed gives identical data; storage per run matches the estimate.

### Phase 3 — Fault injection (first slice)
- Implement three scenarios: backhaul degradation, cell congestion, normal variation.
- Add severity, target, duration, and seed configuration.
- Store fault configuration and hidden ground truth in the `evaluation` schema.
- Build scenario library and simulation launcher.

**Acceptance:** Faults produce expected observable KPI changes; fixed seeds reproduce results; import boundary and leak tests pass.

### Phase 4 — Detection
- Implement rolling statistical detector.
- Implement the data-gap detector.
- Add alert grouping.
- Implement Isolation Forest with the training seed range and in-memory model.
- Persist versions and scores.
- Overlay anomalies on charts.

**Acceptance:** Fault scenarios produce detectable anomalies and normal controls support false-positive measurement using the documented matching rules.

### Phase 5 — Incidents
- Create incidents from grouped detections (titles from detections only).
- Implement incident APIs, filters, timeline, and evidence view.
- Highlight affected topology nodes.

**Acceptance:** User can navigate from detection to incident details.

### Phase 6 — Investigation (deterministic)
- Write versioned runbooks for the slice scenarios.
- Implement the deterministic rule-based investigator as the LangGraph workflow (lazy import).
- Add evidence-grounded structured diagnosis, confidence formula, and abstention.

**Acceptance:** Diagnosis evidence maps to real stored observations; no hidden truth enters inference.

### Phase 7 — Evaluation and benchmarks (slice complete)
- Implement evaluator-only ground-truth access.
- Score root cause, components, evidence, checks, and abstention.
- Add benchmark suites (regenerated telemetry, not stored) and version comparisons.

**Acceptance:** Scores are repeatable; ground truth stays hidden until evaluation; the full slice works on the public deployment.

### Phase 8 — Widen scenarios and optional AI
- Implement the remaining seven scenarios and their runbooks.
- Add Mystery incident mode.
- Add the optional free-tier LLM provider with daily cap, caching, and fallback.

**Acceptance:** All ten scenarios pass the same tests as the slice; the app works identically with the AI provider disabled.

### Phase 9 — Reports and polish
- Add HTML incident/benchmark reports with print stylesheet.
- Complete loading, cold-start, empty, error, and success states.
- Improve responsive design and documentation.

**Acceptance:** Core workflows are usable without developer help.

### Phase 10 — Testing and hardening
- Complete unit, integration, resource, and end-to-end tests.
- Validate input limits, rate limits, run expiry, cleanup, and access boundaries.
- Verify demo mode without credentials.
- Optimize telemetry queries.

**Acceptance:** Critical tests pass from a clean local setup and in CI.

### Phase 11 — Final public release
- Seed the showcase run and showcase benchmark from your machine.
- Enable the cleanup (and optional keep-warm) workflows.
- Verify the free-tier budget (Section 17).
- Record a short demo video/GIF for the README (so reviewers can see the app even during a cold start).
- Test the full public workflow in a clean browser.

**Acceptance:** Public demo works end-to-end without any paid service or API key.

## 20. Definition of Done

- [ ] Interactive simulated RAN topology (two seeded topologies, typed transport links).
- [ ] Deterministic normal telemetry stored as compact series.
- [ ] Ten fault/control scenarios plus Mystery incident mode.
- [ ] Ground truth and fault configuration isolated in the `evaluation` schema, enforced by tests.
- [ ] Statistical anomaly detector.
- [ ] Isolation Forest detector (separate training seeds, no model files on disk).
- [ ] Data-gap detector.
- [ ] Grouped incidents.
- [ ] Telemetry and topology evidence views.
- [ ] Structured investigation with documented confidence and abstention.
- [ ] Deterministic evaluator and benchmark comparisons.
- [ ] HTML reports with print-to-PDF.
- [ ] Demo mode without an AI key, with a pre-computed showcase.
- [ ] Automated tests for critical workflows, running in GitHub Actions.
- [ ] Frontend deployed on Vercel Hobby.
- [ ] FastAPI backend on Render free and PostgreSQL on Neon free.
- [ ] Free-tier budget verified; no payment method required anywhere.
- [ ] README explains setup, architecture, demo, free-hosting cold start, and limitations.
- [ ] Clearly identified as an independent simulation, not an Airspan product.

## 21. Portfolio Positioning

**Short description:** RANOps AI is a simulation-driven 5G/Open RAN operations platform that generates synthetic network telemetry, injects faults, detects anomalies using statistical and ML methods, and investigates incidents through evidence-grounded AI workflows. It includes hidden-ground-truth evaluation and versioned reliability benchmarks.

**Resume bullets — use only after implementing and measuring the features:**
- Built a simulation-driven 5G/Open RAN operations platform using FastAPI, React, PostgreSQL, NetworkX, and scikit-learn to generate telemetry, inject network faults, detect anomalies, and investigate incidents.
- Implemented deterministic scenario evaluation and benchmark comparisons for root-cause accuracy, component identification, detection delay, and false-positive rate.
- Developed an evidence-grounded LangGraph investigation workflow with runbook retrieval, confidence checks, and an API-key-free demo fallback.
- Deployed the full stack at zero cost (Vercel, Render, Neon, GitHub Actions) within free-tier memory, storage, and compute budgets.

Do not invent performance metrics. Add measured results only after running documented experiments.

## 22. Instructions for Claude Code

Treat this file as the project source of truth.

1. Read the complete `RANOps_AI_PROJECT.md`, `requirement.md`, and the `context/` docs (system design, architecture, roadmap, deployment, performance review, benchmark) before coding.
2. Inspect the repository before creating or replacing files.
3. Implement one roadmap phase at a time.
4. Do not skip tests or leave non-functional placeholder buttons.
5. Keep business logic in backend service modules.
6. Use typed Pydantic schemas and SQLAlchemy models.
7. Use Alembic for schema changes.
8. Keep ground truth and fault configuration inaccessible to inference services and public APIs; keep the import boundary and leak tests passing.
9. Make simulation deterministic for a fixed seed.
10. Ensure demo mode works without external AI credentials.
11. Keep secrets in environment variables and maintain `.env.example`.
12. Do not use Streamlit or a Node.js backend.
13. Do not connect to or control real telecom equipment.
14. Respect the free-tier constraints in Section 17: no paid services, no Redis/worker, no files on local disk, `/health` never touches the database, keep backend memory under budget, lazy-import heavy libraries.
15. After each phase, run tests and report changed files, commands, results, and remaining issues; update `context/phasewise_roadmap.md` (tracker + phase report), `context/performance_review.md` (measurements), and `context/benchmark.md` (results) with real numbers only.
16. Do not start the next phase until the current phase meets its acceptance criteria.

### First task
Implement **Phase 0 only**: inspect the repository, establish frontend and backend skeletons, configure local development, implement `/health` (no DB) and `/health/ready`, connect the frontend to the backend including the cold-start state, add basic tests and GitHub Actions CI, and prepare the free-tier deployment configuration (Vercel, Render, Neon). Do not implement simulation, detection, or AI investigation until the foundation works.
