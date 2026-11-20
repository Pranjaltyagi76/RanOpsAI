# System Design — RANOps AI

| | |
|---|---|
| Purpose | Concrete design decisions, defaults, algorithms, and formulas to implement against. Use this when writing code; use `architecture.md` for module boundaries and flows. |
| Source of truth | [`../RANOps_AI_PROJECT.md`](../RANOps_AI_PROJECT.md) — this file refines it and must not contradict it. |
| Update rule | When an implementation changes a default, formula, or schema, update this file **in the same commit** and bump the relevant version (§11). Values marked *initial default* are expected to be tuned in their phase. |

---

## 1. Domain model

### 1.1 Component types and keys

| Type | `component_type` | Key pattern | Example |
|---|---|---|---|
| Core endpoint | `core` | `CORE-NN` | `CORE-01` |
| Backhaul link (CU↔Core, NG) | `transport_link`, `link_type=backhaul` | `LINK-BH-NN` | `LINK-BH-01` |
| Central Unit | `cu` | `CU-NN` | `CU-01` |
| Midhaul link (DU↔CU, F1) | `transport_link`, `link_type=midhaul` | `LINK-MH-NN` | `LINK-MH-02` |
| Distributed Unit | `du` | `DU-NN` | `DU-02` |
| Fronthaul link (RU↔DU, 7.2x) | `transport_link`, `link_type=fronthaul` | `LINK-FH-NN` | `LINK-FH-03` |
| Radio Unit | `ru` | `RU-NN` | `RU-04` |
| Cell | `cell` | `CELL-NN` | `CELL-01` |
| UE group | `ue_group` | `UEG-NN` | `UEG-02` |

Component keys are stable across runs and seeds; they are what ground truth and diagnoses refer to.

### 1.2 Graph

- Directed edges point **downstream** (towards UEs): `CORE → LINK-BH → CU → LINK-MH → DU → LINK-FH → RU → CELL → UEG`.
- "Upstream of X" = ancestors of X; "impact set of X" = X plus its descendants.
- NetworkX `DiGraph` built once per topology and cached in memory (topologies are immutable after seeding).

### 1.3 Seeded topologies

| Topology | Components | Series per run | Values per default run (360 pts) |
|---|---|---|---|
| `demo-small` | 13: 1 core, 1 BH, 1 CU, 1 MH, 1 DU, 2 FH, 2 RU, 2 cells, 2 UE groups | 55 | 19,800 |
| `demo-medium` | 23: 1 core, 1 BH, 1 CU, 2 MH, 2 DU, 4 FH, 4 RU, 4 cells, 4 UE groups | 99 | 35,640 |

In `demo-medium`, DU-01 → RU-01/02 → CELL-01/02 → UEG-01/02 and DU-02 → RU-03/04 → CELL-03/04 → UEG-03/04.

---

## 2. Metrics

### 2.1 Catalogue

The project spec's suggested list plus five extensions needed by the component table (`processing_delay_ms`, `tx_power_dbm`, `temperature_c`, `bandwidth_utilization_pct`, `active_sessions`).

| Metric | Unit | Valid range | Bad direction |
|---|---|---|---|
| `availability` | % | 0–100 | down |
| `cpu_utilization` | % | 0–100 | up |
| `memory_utilization` | % | 0–100 | up |
| `latency_ms` | ms | ≥ 0 | up |
| `processing_delay_ms` | ms | ≥ 0 | up |
| `packet_loss_pct` | % | 0–100 | up |
| `bandwidth_utilization_pct` | % | 0–100 | up |
| `throughput_mbps` | Mbps | ≥ 0 | down |
| `traffic_load_mbps` | Mbps | ≥ 0 | both |
| `active_ues` | count | ≥ 0 | both |
| `active_sessions` | count | ≥ 0 | both |
| `prb_utilization_pct` | % | 0–100 | up |
| `handover_failure_rate_pct` | % | 0–100 | up |
| `rsrp_dbm` | dBm | −140 to −44 | down |
| `sinr_db` | dB | −20 to 40 | down |
| `tx_power_dbm` | dBm | 0–50 | down |
| `temperature_c` | °C | −40 to 100 | up |

"Bad direction" drives detector polarity (§5.1): a metric only alerts in its bad direction; `both` alerts either way.

### 2.2 Metrics per component type and baselines (*initial defaults*)

Baseline = mean level before diurnal/noise. Noise σ is relative to baseline unless marked absolute.

| Type | Metric | Baseline | Noise σ |
|---|---|---|---|
| core | availability | 99.95 | 0.02 abs |
| core | latency_ms | 4 | 8 % |
| core | packet_loss_pct | 0.02 | 0.01 abs |
| transport_link | availability | 99.9 | 0.03 abs |
| transport_link | latency_ms | BH 6 · MH 2 · FH 0.2 | 8 % |
| transport_link | packet_loss_pct | 0.05 | 0.02 abs |
| transport_link | bandwidth_utilization_pct | 40 | 6 % |
| cu | availability | 99.95 | 0.02 abs |
| cu | cpu_utilization | 35 | 6 % |
| cu | memory_utilization | 50 | 3 % |
| cu | active_sessions | 400 per cell below it | 5 % |
| du | availability | 99.95 | 0.02 abs |
| du | cpu_utilization | 40 | 6 % |
| du | memory_utilization | 55 | 3 % |
| du | processing_delay_ms | 0.8 | 8 % |
| ru | availability | 99.9 | 0.03 abs |
| ru | tx_power_dbm | 40 | 0.3 abs |
| ru | temperature_c | 45 | 1.0 abs |
| cell | availability | 99.9 | 0.03 abs |
| cell | prb_utilization_pct | 45 | 8 % |
| cell | rsrp_dbm | −88 | 1.5 abs |
| cell | sinr_db | 15 | 1.2 abs |
| cell | handover_failure_rate_pct | 1.0 | 0.25 abs |
| cell | throughput_mbps | 250 | 8 % |
| cell | traffic_load_mbps | 180 | 8 % |
| ue_group | active_ues | 120 | 5 % |
| ue_group | throughput_mbps | 25 (average per UE) | 8 % |
| ue_group | latency_ms | 18 | 8 % |
| ue_group | packet_loss_pct | 0.1 | 0.03 abs |

All generated values are clamped to the valid range (§2.1).

---

## 3. Telemetry generation

### 3.1 Deterministic randomness

- Use `numpy.random.Generator(PCG64)` built from `numpy.random.SeedSequence`.
- Entropy per series: `[run_seed, crc32(topology_key), crc32(component_key), crc32(metric_name), SIM_VERSION_MAJOR]`.
- **Never use Python's built-in `hash()`** for seeding — it is randomized per process.
- Independent streams per series make results independent of iteration order and of which other series exist.
- Fault randomness (e.g., Mystery selection) uses its own `SeedSequence` derived from the run seed with a fixed `"fault"` salt.

### 3.2 Normal signal model

For point index `t` (minutes since run start), for each series:

```text
diurnal(t)  = 1 + A · sin(2π · (t + φ) / P)          P = 1440, A per metric (0.05–0.25), φ from the series RNG
drift(t)    = random walk, step σ_d = 0.002 · baseline, mean-reverting (θ = 0.02)
noise(t)    = Normal(0, σ)                            σ from §2.2
spike(t)    = harmless spike: p = 0.004 per point, magnitude 2–3 σ, length 1–2 points

value(t)    = clamp( baseline · diurnal(t) + drift(t) + noise(t) + spike(t) )
```

- Traffic-like metrics (`traffic_load_mbps`, `prb_utilization_pct`, `active_ues`, `active_sessions`, `bandwidth_utilization_pct`, `cpu_utilization`) use larger `A` (0.15–0.25); availability and signal metrics use `A ≈ 0`.
- Harmless spikes are deliberately below the default detection persistence (§5.1) most of the time — they exist to create realistic false-positive pressure.

### 3.3 Cross-component coupling

Normal telemetry stays loosely consistent with the topology:
- Cell `traffic_load_mbps` drives cell `prb_utilization_pct` (≈ linear) and DU `cpu_utilization` (sum of its cells).
- UE-group `latency_ms` = its cell's radio latency component + sum of upstream link `latency_ms` + DU `processing_delay_ms`.
- Generate in topological order (upstream first) so downstream series can read upstream values.

### 3.4 Simulation defaults

| Setting | Default | Notes |
|---|---|---|
| Interval | 60 s | Fixed for MVP |
| Points | 360 | Cap `MAX_RUN_POINTS` = 720 |
| Warm-up | 180 points | No fault before this |
| Fault window | 60 points | Configurable 10–180, must end before run end |
| Start time | `2026-01-01T00:00:00Z` | Fixed epoch → deterministic timestamps |

### 3.5 Storage

```text
telemetry_series(run_id, component_id, metric_name, start_at, interval_seconds, values REAL[])
```

- `float32` precision is sufficient; `NaN`/missing stored as SQL `NULL` array elements.
- Bulk insert all series of a run in one transaction.
- Reads return whole arrays; slicing/downsampling happens in Python with NumPy.

---

## 4. Fault injection

### 4.1 Mechanics

- A fault is applied to the generated normal arrays **after** generation, over `[fault_start, fault_end)`.
- Onset shape: linear ramp over the first 3 points (except `kpi_drift`, which ramps over the whole window, and `cell_outage`/`ru_failure` high, which are steps).
- Offset is applied to the **target** component and propagated to the impact set with attenuation `α` per hop (*initial default* `α = 0.7`) along the metrics listed in "Propagates to".
- Severity levels: `low`, `medium`, `high`.

### 4.2 Scenario catalogue (*initial defaults*)

| Scenario ID | Root cause label | Target | Injection (low / medium / high) | Propagates to |
|---|---|---|---|---|
| `backhaul_degradation` | `transport_link_degradation` | `LINK-BH-*` (MH variant allowed) | latency +30 / +80 / +200 ms; loss +0.5 / +2 / +5 pp | all UE groups downstream: latency, packet loss ↑; throughput −5 / −15 / −30 % |
| `cell_congestion` | `cell_congestion` | `CELL-*` | traffic ×1.3 / ×1.6 / ×2.0; PRB → 85 / 92 / 98 % | that cell's UE group throughput −10 / −25 / −45 %, latency ↑ |
| `ru_failure` | `radio_unit_failure` | `RU-*` | availability → 90 / 50 % ; high = telemetry stops (NULLs) | its cell availability, throughput, traffic ↓; its UE group throughput ↓ |
| `handover_failure_spike` | `handover_failure` | `CELL-*` | HO failure +3 / +8 / +15 pp | UE group packet loss slightly ↑ |
| `radio_interference` | `radio_interference` | `CELL-*` | SINR −4 / −8 / −14 dB | cell + UE group throughput −10 / −25 / −45 % |
| `traffic_surge` | `traffic_surge` | `UEG-*` (and its cell) | active UEs ×1.3 / ×1.7 / ×2.2; traffic same factor | cell PRB ↑, DU CPU ↑ (no hardware fault) |
| `du_saturation` | `du_saturation` | `DU-*` | CPU → 85 / 93 / 99 %; processing delay ×2 / ×4 / ×8 | all cells/UEs under the DU: latency ↑, throughput ↓ |
| `cell_outage` | `cell_outage` | `CELL-*` | step: availability 0, traffic 0, throughput 0 | its UE group active UEs → 0; neighbour cells under same DU traffic +20 % |
| `kpi_drift` | `kpi_drift` | any component + one applicable metric | linear ramp to Δ = 1.5 / 3 / 5 σ by window end | none |
| `normal_variation` | `no_fault` | any | harmless spike 2–4 points at +2 / +3 / +4 σ, or load swell ×1.2 | none |

### 4.3 Hidden vs public data

| Data | Lives in | Visible to |
|---|---|---|
| Scenario name, description, severity options, target requirements | `public.scenario_definitions` | everyone |
| Injection template, root-cause label, expected symptoms, expected checks | `faults` catalogue (code) → seeded into `evaluation.scenario_hidden` | world side + evaluator |
| Per-run scenario, target, severity, window, parameters | `evaluation.run_fault_configs` | world side + evaluator |
| Per-run ground truth (root cause, affected components, symptoms, checks) | `evaluation.scenario_ground_truth` | evaluator only |

Expected affected components = target + impact set members whose metrics are actually modified.

### 4.4 Mystery incident

Server samples (scenario, eligible target, severity, seed ≥ 10000) from the fault RNG; `simulation_runs.label = "Mystery incident"`, `is_mystery = true`. Revealed only through the evaluation endpoint after evaluation completes.

---

## 5. Detection

### 5.1 Rolling robust statistical detector — `stat` (*initial defaults*)

```text
window        W = 60 points (trailing, excludes current point)
min history   H = 30 non-missing points (else: no decision)
median_t      = median(x[t-W : t])
MAD_t         = median(|x[t-W : t] - median_t|)
scale_t       = max(1.4826 · MAD_t, ε),   ε = max(1e-6, 0.01 · |median_t|)
z_t           = (x_t - median_t) / scale_t
breach_t      = z_t ≥ +k  (bad=up) | z_t ≤ −k (bad=down) | |z_t| ≥ k (both),   k = 4.0
anomaly       = breach on P = 3 consecutive points → one detection spanning the breach run
```

- Missing points are skipped (do not reset or extend persistence).
- Zero variance handled by `ε`.
- One detection per contiguous breach run; `observed_value` = most extreme value, `baseline` = median at breach start, `score` = max |z|.
- Severity: |z| < 6 low, < 10 medium, ≥ 10 high; availability drop below 50 % ⇒ critical.

### 5.2 Isolation Forest — `iforest`

- One model **per component type**, features = that type's metrics, standardized with training mean/std.
- Training data: normal-control runs, seeds **1000–1019**, both topologies, all points after warm-up.
- `IsolationForest(n_estimators=100, max_samples=256, contamination="auto", random_state=42)`.
- Score = `−score_samples(x)` (higher = more anomalous). Threshold = 99.5th percentile of training scores. Persistence P = 3.
- Detection `metric` = `"multivariate"`; evidence lists the top-3 features by |standardized deviation|.
- Model is trained lazily on first use, cached in process memory, and identified by a hash of (version, config, training seeds). Never written to disk.
- Rows with any missing feature are skipped.

### 5.3 Data-gap detector — `gap`

- Flags a series when ≥ N = 3 consecutive points are `NULL`. One detection per gap; severity high; score = gap length.

### 5.4 Alert grouping

1. Sort detections by `window_start`.
2. Two detections are related if their windows are within **G = 5 points** of each other **and** their components are within **2 hops** in the undirected topology graph (same component counts as 0 hops).
3. Connected components of the "related" graph (union-find) become incidents.
4. Incident window = min start … max end; severity = max detection severity; `component_ids` = union.
5. Title = `"<dominant metric label> anomaly on <most upstream component> + N related components"`.

### 5.5 Detection evaluation (matching rules)

| Term | Definition |
|---|---|
| True positive (TP) | component ∈ expected affected set **and** window overlaps `[fault_start, fault_end + 10]` |
| False positive (FP) | any detection on a `normal_variation` / normal-control run, or outside expected components / tolerated window |
| False negative (FN) | fault run with zero TP |
| Precision | TP / (TP + FP) over detections |
| Recall | runs with ≥ 1 TP / fault runs |
| F1 | 2PR / (P + R) |
| Detection delay | first TP `window_start` − `fault_start` (points and minutes) |
| FP rate | FP detections per 100 series-hours on normal-control runs |
| Alert count | detections and incidents per run |

---

## 6. Investigation

### 6.1 Context (input whitelist)

```python
class InvestigationContext(BaseModel):
    incident: IncidentView              # id, window, severity, component keys, detections
    series: dict[SeriesKey, SeriesView] # only series of incident components + 1-hop neighbours
    topology: TopologyView              # nodes, edges, types, link types
    runbooks: list[RunbookView]         # retrieved by keyword
```

No run label, scenario, fault config, or evaluation data — enforced by construction and by the leak test.

### 6.2 Pipeline (LangGraph nodes)

| Node | Deterministic behaviour (demo provider) |
|---|---|
| `load_incident` | Build `InvestigationContext`. |
| `summarize_telemetry` | Per series: baseline (pre-incident median), peak deviation, direction, duration, missing ratio. |
| `inspect_topology` | Find the **most upstream anomalous component** (closest common ancestor of anomalous components that is itself anomalous, else the LCA). |
| `retrieve_runbook` | Keyword match of anomalous (component type, metric, direction) triples against runbook symptom tags; top 3 runbooks. |
| `generate_hypotheses` | One hypothesis per retrieved runbook + `no_fault`. |
| `verify_evidence` | Evaluate each runbook's confirmation checks against summaries; attach evidence items with real observed/baseline values. |
| `check_confidence` | Compute confidence (§6.3); decide abstention. |
| `format_diagnosis` | Produce the structured diagnosis; validate with Pydantic. |

Bounded retries: an LLM provider may retry `generate_hypotheses`/`verify_evidence` at most 2 times; on failure the demo provider result is returned with `is_fallback = true`.

### 6.3 Confidence and abstention (agent v1)

```text
coverage    = satisfied confirmation checks / total confirmation checks   (primary hypothesis)
margin      = min(1, (score_1 − score_2) / 0.5)                            (score = coverage per hypothesis)
completeness= 1 − missing ratio across evidence series
confidence  = 0.6 · coverage + 0.3 · margin + 0.1 · completeness

abstain if confidence < ABSTAIN_THRESHOLD (0.5) or (score_1 − score_2) < 0.1
```

When abstaining, `primary_hypothesis` is still reported but `abstained = true`. `no_fault` with coverage ≥ others ⇒ diagnosis "no fault detected" (not an abstention).

### 6.4 Diagnosis schema

```json
{
  "incident_id": "INC-0001",
  "primary_hypothesis": "transport_link_degradation",
  "root_component": "LINK-BH-01",
  "affected_components": ["LINK-BH-01", "CU-01"],
  "confidence": 0.82,
  "evidence": [
    {"component_id": "LINK-BH-01", "metric": "latency_ms", "at": "2026-01-01T03:12:00Z",
     "observed_value": 85.0, "baseline_value": 12.0, "observation": "Latency increased above baseline"}
  ],
  "alternative_hypotheses": ["upstream_congestion"],
  "recommended_checks": [{"check_id": "transport.packet_loss", "text": "Inspect transport-link packet loss"}],
  "abstained": false,
  "provider": "demo",
  "is_fallback": false,
  "agent_version": "agent-demo-1.0.0"
}
```

`recommended_checks` use **check IDs from a controlled vocabulary** defined in runbooks so that check relevance can be scored deterministically.

### 6.5 Runbooks

Stored in `runbooks` (seeded from `backend/app/services/runbooks/catalog/*.md` with YAML front matter):

```yaml
fault_type: transport_link_degradation
version: 1
symptom_tags: [transport_link:latency_ms:up, transport_link:packet_loss_pct:up, ue_group:latency_ms:up]
confirmation_checks:
  - id: transport.latency_above_baseline
    rule: "transport_link.latency_ms deviation >= 3x baseline scale"
  - id: transport.packet_loss
    rule: "transport_link.packet_loss_pct up"
  - id: transport.downstream_latency
    rule: "any downstream ue_group.latency_ms up"
alternatives: [upstream_congestion, du_saturation]
safe_next_checks: [transport.packet_loss, transport.adjacent_latency]
```

---

## 7. Evaluation scoring

| Metric | Formula |
|---|---|
| Root-cause top-1 | `primary_hypothesis == root_cause` |
| Root-cause top-3 | `root_cause ∈ [primary] + alternatives[:2]` |
| Root component hit | `root_component == target_component_key` |
| Component Jaccard | `|pred ∩ expected| / |pred ∪ expected|` |
| Evidence precision | evidence items whose (component, metric) ∈ expected symptoms / evidence items |
| Evidence recall | expected symptoms covered by ≥ 1 evidence item / expected symptoms |
| Check relevance | recommended `check_id`s ∈ expected checks / recommended checks |
| Policy compliance | passed / total of: schema valid · every evidence value matches stored data (±1e-3 rel) · no hidden label in context · no command-like recommendations · confidence in [0, 1] |
| Abstention quality | on `no_fault` runs: correct if abstained or predicted `no_fault`; on fault runs: abstention counted separately (not as a wrong root cause) and reported as abstain rate |

Aggregate per benchmark = mean over cases (and per-scenario breakdown).

---

## 8. Data model (DDL-level summary)

See project spec §12 for the full table list. Key column types:

| Table | Notable columns |
|---|---|
| `simulation_runs` | `id UUID PK`, `status TEXT CHECK IN (queued,running,completed,failed)`, `stage TEXT`, `random_seed BIGINT`, `is_mystery BOOL`, `is_showcase BOOL`, `expires_at TIMESTAMPTZ NULL` |
| `telemetry_series` | `values REAL[] NOT NULL`, `start_at TIMESTAMPTZ`, `interval_seconds INT`, `UNIQUE(run_id, component_id, metric_name)` |
| `detection_results` | `window_start/window_end INT` (point indices) + derived timestamps in API |
| `investigations` | `diagnosis JSONB`, `UNIQUE(incident_id, agent_version, provider)` (enables caching) |
| `evaluation.*` | lives in schema `evaluation`; FKs to `public.simulation_runs(id) ON DELETE CASCADE` |

IDs: UUID v4 internally; human-friendly display IDs (`INC-0001`) derived per run.

---

## 9. API contract conventions

- Base path `/api/v1`. JSON, snake_case.
- Pagination: `limit` (default 20, max 100), `offset`; response `{ "items": [...], "total": n, "limit": l, "offset": o }`.
- Errors: `{ "error": { "code": "run_not_found", "message": "…", "details": {} } }` with proper HTTP status.
- Long operations (`POST /simulations`, `/detect`, `/benchmarks`) return `202 Accepted` with `{ "id": …, "status": "queued" }`; clients poll `/status`.
- Telemetry response: `{ "component_id", "metric", "interval_seconds", "points": [[iso_ts, value|null], …], "downsampled": bool }`. Downsampling: bucket mean, plus min/max per bucket when `include_range=true`.
- Hidden fields are never part of public response schemas (separate Pydantic models; no `exclude` tricks).

---

## 10. Jobs

- `JobRunner` with an `asyncio.Semaphore(1)`; jobs run CPU-bound work in a thread (`anyio.to_thread.run_sync`) so the event loop keeps serving requests.
- States: `queued → running → completed | failed`; `stage` for UI progress (`simulating`, `detecting`, `grouping`, `investigating`, `evaluating`).
- Startup: `running`/`queued` → `failed` ("interrupted by server restart"); delete expired visitor runs.

---

## 11. Versioning

| Artifact | Format | Bump when |
|---|---|---|
| Simulator | `sim-MAJOR.MINOR.PATCH` | Any change that alters output for identical inputs ⇒ MINOR (or MAJOR if seeding changes) |
| Detectors | `stat-x.y.z`, `iforest-x.y.z`, `gap-x.y.z` | Algorithm, defaults, or training-set change |
| Agent | `agent-demo-x.y.z`, `agent-gemini-x.y.z` | Pipeline, prompt, confidence formula, or runbook change |
| Runbooks | integer `version` per fault type | Content change |
| Scenario suite | `slice-v1`, `full-v1` | Any case added/removed/changed |
| Scenario | `scenario_version` | Injection template change |

Versions are constants in code (`app/core/versions.py`), recorded on every result row.

---

## 12. Seed ranges

| Range | Use |
|---|---|
| 1–999 | Benchmark suites |
| 1000–1999 | Isolation Forest training (1000–1019 used by `iforest-1.x`) |
| 2000–2999 | Showcase runs |
| ≥ 10000 | Visitor and Mystery runs |

A test asserts these ranges never overlap in configuration.
