# P3 ScenarioPack Required Trigger + Unified Pass Condition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add required trigger support and unified pass evaluation, then update S1/S2/S3 scenario packs (with S3 quota + management required triggers) using standard metrics keys and last_settle windows.

**Architecture:** Extend ScenarioStep schema with optional required_triggers and make guided-mode evaluation treat required_triggers as the must-pass set (fallback to pass_condition for backward compatibility). Update scenario pack validation to include required_triggers metrics, and adjust scenario YAML actions to guarantee quota consumption via set_param + advance with n_batches looping.

**Tech Stack:** Python (FastAPI + Pydantic), TypeScript (Next.js), YAML ScenarioPack data

---

## Parallel Task Graph

- Track A (Schema + Validation)
  - A1: Add required_triggers to Python + TS schemas
  - A2: Update scenario_pack_loader metric validation to include required_triggers
  - A3: Add/adjust backend tests for required_triggers validation
- Track B (Guided Mode evaluation)
  - B1: Update guided-mode evaluation to use required_triggers list (fallback to pass_condition)
  - B2: Support advance.n_batches + loop-until in guided-mode action handler
- Track C (Scenario data updates)
  - C1: Update S1/S2 windows to last_settle and ensure standard metric keys
  - C2: Update S3 steps: required_triggers + must-pass action payloads
- Optional Track D (Teaching-only action)
  - D1: Add teaching_only action types inject_cases/force_special_candidates (if quota is still flaky)

Dependencies:
- B1 depends on A1 (types)
- C2 depends on B2 (advance.n_batches/loop-until) if used
- D1 only if C2 still fails to reach quota reliably

---

### Task 1: Add required_triggers schema support and validation

**Files:**
- Modify: `services/engine/models/schemas.py`
- Modify: `packages/shared/src/scenariopack.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `services/engine/core/scenario_pack_loader.py`
- Create: `services/engine/tests/test_scenario_pack_validation.py`

**Step 1: Write the failing test**

```python
def test_pack_loader_rejects_missing_required_trigger_metrics(tmp_path):
    pack = {
        "id": "s_test",
        "title": "test",
        "timebox_minutes": 10,
        "learning_objective": "test",
        "region_id": "beijing_drg_demo",
        "seed": 1,
        "initial_params": {},
        "policy_version_tag": "test",
        "steps": [
            {
                "step_id": "s-1",
                "instruction": "test",
                "action": {"type": "advance", "payload": {"batches": 1}},
                "expected_observation": ["a", "b"],
                "expected_rules": [],
                "required_triggers": [
                    {"metric": "not.in.catalog", "operator": ">", "threshold": 0, "window": "last_settle"}
                ],
                "pass_condition": {"metric": "drg.pay_total", "operator": ">", "threshold": 0, "window": "last_settle"},
                "explain_check": {
                    "question": "q",
                    "options": ["a", "b"],
                    "correct_option_index": 0,
                    "rationale": "r"
                }
            }
        ],
        "completion": {
            "export_required": True,
            "artifacts": ["scenario.json"],
            "summary_template": "ok"
        }
    }
```

**Step 2: Run test to verify it fails**

Run: `pytest services/engine/tests/test_scenario_pack_validation.py -v`
Expected: FAIL, required_triggers not validated and/or schema rejects unknown field.

**Step 3: Write minimal implementation**

```python
class ScenarioStep(BaseModel):
    required_triggers: Optional[list[ScenarioPassCondition]] = None
```

```python
def _validate_pack_metrics(self, pack: ScenarioPack) -> list[str]:
    metric_keys = []
    for step in pack.steps:
        metric_keys.append(step.pass_condition.metric)
        for rule in step.expected_rules or []:
            metric_keys.append(rule.metric)
        for rule in step.required_triggers or []:
            metric_keys.append(rule.metric)
    return find_missing_metric_keys(metric_keys)
```

**Step 4: Run test to verify it passes**

Run: `pytest services/engine/tests/test_scenario_pack_validation.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add services/engine/models/schemas.py services/engine/core/scenario_pack_loader.py packages/shared/src/scenariopack.ts apps/web/lib/api.ts services/engine/tests/test_scenario_pack_validation.py
git commit -m "feat: add required triggers to scenario packs"
```

---

### Task 2: Unify pass evaluation in guided mode and support advance.n_batches

**Files:**
- Modify: `apps/web/components/watch/GuidedMode.tsx`

**Step 1: Update evaluation to use required_triggers**

```ts
const requiredTriggers = currentStep.required_triggers?.length
  ? currentStep.required_triggers
  : [currentStep.pass_condition]

const allPassed = requiredTriggers.every((rule) => {
  const ruleMetrics = metricsByWindow[rule.window || 'last_settle']
  return evaluatePassCondition(rule, ruleMetrics).passed
})
```

**Step 2: Support advance.n_batches and loop-until (max cap)**

```ts
const nBatches = Number(payload.n_batches ?? payload.batches ?? 1)
const loopUntil = Boolean(payload.loop_until)
const maxBatches = Number(payload.max_batches ?? nBatches)
```

**Step 3: Manual test**

- Start S3 in guided mode
- Execute step with advance.n_batches
- Confirm it loops until required triggers pass or max_baches reached

**Step 4: Commit**

```bash
git add apps/web/components/watch/GuidedMode.tsx
git commit -m "feat: evaluate required triggers in guided mode"
```

---

### Task 3: Update ScenarioPack YAML (S1/S2/S3)

**Files:**
- Modify: `data/scenarios/s1_point_value_down.yml`
- Modify: `data/scenarios/s2_case_mix_heavy.yml`
- Modify: `data/scenarios/s3_special_quota.yml`

**Step 1: Normalize windows to last_settle where possible**

```yaml
window: last_settle
```

**Step 2: Add required_triggers to S3 and ensure must-pass action**

```yaml
required_triggers:
  - metric: drg.quota.ratio
    operator: ">="
    threshold: 0.9
    window: last_settle
  - metric: drg.management_effect
    operator: ">"
    threshold: 0
    window: last_settle
```

**Step 3: Add set_param + advance.n_batches with loop_until**

```yaml
action:
  type: set_param
  payload:
    special_aggressiveness: 1.0
    special_case_candidate_rate: 1.0
    advance_batches: 6
```

```yaml
action:
  type: advance
  payload:
    n_batches: 6
    loop_until: true
    max_batches: 24
```

**Step 4: Run loader validation**

Run: `python scripts/demo_missing_metric_validation.py`
Expected: no missing metric keys for s1/s2/s3

**Step 5: Commit**

```bash
git add data/scenarios/s1_point_value_down.yml data/scenarios/s2_case_mix_heavy.yml data/scenarios/s3_special_quota.yml
git commit -m "chore: align scenario metrics and required triggers"
```

---

### Task 4 (Optional): Teaching-only action if quota still flaky

**Files:**
- Modify: `packages/shared/src/scenariopack.ts`
- Modify: `services/engine/models/schemas.py`
- Modify: `apps/web/components/watch/GuidedMode.tsx`
- Modify: `services/engine/main.py` (add teaching-only endpoint)
- Modify: `services/engine/core/scenario.py` (apply injected cases)

**Step 1: Add action type + teaching_only flag**

```ts
type: z.enum(['set_param', 'toggle_strategy', 'advance', 'inject_cases', 'force_special_candidates'])
```

**Step 2: Add API endpoint**

```python
@app.post("/scenario/{scenario_id}/teaching/inject_cases")
```

**Step 3: Guard by teaching_only and guided mode only**

- If teaching_only true, ignore in free mode

**Step 4: Manual verification**

- Use S3 in guided mode to confirm quota ratio reaches target reliably

**Step 5: Commit**

```bash
```

---

## Test Plan

- `pytest services/engine/tests/test_scenario_pack_validation.py -v`
- `python scripts/demo_missing_metric_validation.py`
- Manual guided-mode run for S1/S2/S3 with /scenario/{id}/metrics at last_settle

---

## Success Criteria

- Scenario packs load without missing metrics validation errors
- Guided mode requires both S3 triggers (quota ratio and management effect) to pass
- S3 step auto-advances (bounded loop) until required triggers met
- Optional teaching-only actions (if added) do not affect free mode
