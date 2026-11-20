# Benchmark Methodology — RANOps AI

| | |
|---|---|
| Purpose | Defines benchmark suites, metrics, procedure, and regression rules; holds the results log. |
| Formulas | Metric definitions live in [`system_design.md` §5.5 and §7](system_design.md); this file references them. |
| Honesty rule | **No invented or estimated numbers.** Results enter the log only from a completed, reproducible benchmark run with all versions recorded. Synthetic-data results never imply real-network accuracy. |

---

## 1. What is benchmarked

| Stage | Question | Key metrics |
|---|---|---|
| Detection | Do detectors flag injected faults quickly without flooding normal runs? | precision, recall, F1, FP rate, detection delay, alert count |
| Grouping | Do detections collapse into the right number of incidents? | incidents per fault run, incidents per normal run |
| Investigation | Is the diagnosis right, grounded, and appropriately humble? | root-cause top-1/top-3, root component hit, component Jaccard, evidence P/R, check relevance, policy compliance, abstention quality |

---

## 2. Suites

Suites are immutable once published; any change creates a new version.

| Suite | Scenarios | Topologies | Seeds | Cases | Where it runs |
|---|---|---|---|---|---|
| `slice-v1` | backhaul_degradation, cell_congestion, normal_variation | demo-small, demo-medium | 1–5 | 3 × 2 × 5 = **30** | server (UI) |
| `full-v1` | all 10 | demo-medium | 1–3 | 10 × 1 × 3 = **30** | server (UI) |
| `full-v1-extended` | all 10 | demo-small, demo-medium | 1–10 | 10 × 2 × 10 = **200** | local CLI only |

Case parameters:
- Severity: cycles `low → medium → high` by seed (`seed % 3`), so each suite covers all severities.
- Target: first eligible component by key order for the scenario, rotated by seed among eligible components.
- Duration: default (360 points, fault window 60 points starting at point 180).
- Seeds are from the **benchmark range 1–999** and never overlap training (1000–1999) or showcase (2000–2999).

---

## 3. Procedure

1. Choose suite + detector versions + agent version (+ provider; `demo` by default).
2. For each case: regenerate telemetry in memory (world side) → detect → group → investigate (observer side, telemetry only) → score (evaluator).
3. Store `benchmark_case_results` per case and `aggregate_metrics` on `benchmark_runs`. **No telemetry is stored.**
4. Record: suite version, simulator version, detector versions + configs, agent version, provider/model, seeds, matching rules, start/end timestamps, git commit SHA.
5. Compare against the baseline benchmark (§5).

Local CLI (Phase 10):

```powershell
cd backend
python -m scripts.benchmark --suite full-v1-extended --agent agent-demo-1.0.0 --out ../benchmark-results/local/
```

LLM providers are **not** used in server benchmarks (quota protection). If an LLM benchmark is run locally, record the model name and date — results are not reproducible across model updates.

---

## 4. Aggregation

- Per-case metrics → mean per scenario → mean over scenarios (macro average, so every scenario weighs equally).
- Detection precision/recall are also reported micro-averaged over all detections.
- Detection delay: median and p90 over detected fault cases.
- Abstention: reported separately for `no_fault` cases (correct-abstain rate) and fault cases (abstain rate).
- Normal-control cases (`normal_variation`) feed FP rate and abstention quality; they are excluded from root-cause accuracy.

---

## 5. Regression rules

A comparison flags a **regression** when, against the baseline on the same suite version:

| Metric | Regression if |
|---|---|
| Root-cause top-1 | drops by > 5 percentage points |
| Detection recall | drops by > 5 pp |
| FP rate | rises by > 20 % relative |
| Median detection delay | rises by > 2 points |
| Evidence precision | drops by > 5 pp |
| Policy compliance | any value < 1.0 (always a regression) |

Comparisons across different suite versions are allowed but labelled "not comparable" for regression purposes.

Baseline = the most recent benchmark marked `baseline` for that suite (set manually after review).

---

## 6. Version registry

Keep in sync with `backend/app/core/versions.py`.

| Component | Current version | Changed in | Change summary |
|---|---|---|---|
| Simulator | `sim-1.0.0` (planned) | — | — |
| Statistical detector | `stat-1.0.0` (planned) | — | — |
| Isolation Forest | `iforest-1.0.0` (planned) | — | — |
| Data-gap detector | `gap-1.0.0` (planned) | — | — |
| Agent (demo) | `agent-demo-1.0.0` (planned) | — | — |
| Suites | `slice-v1`, `full-v1` (planned) | — | — |

---

## 7. Results log

| Date | Benchmark ID | Suite | Sim | Detectors | Agent | Commit | Top-1 | Top-3 | Det. recall | Det. precision | FP rate /100 sh | Median delay (pts) | Evidence P / R | Policy | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | No benchmark runs yet (pre-Phase 0) |

---

## 8. Experiment notes

Use this section for documented tuning experiments (e.g., changing `k` from 4.0 to 3.5). Each note: hypothesis → change → suite → before/after (from the results log) → decision → version bump.

_None yet._
