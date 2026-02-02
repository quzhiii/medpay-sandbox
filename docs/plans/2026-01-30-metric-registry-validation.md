# Metric Registry + Reference Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing metric registry catalog to support `windows_supported` while keeping `window_supported` backward compatible, and enforce missing-metric validation that blocks guided mode, with a standalone demo script.

**Architecture:** Keep the existing JSON metric catalog and add `windows_supported` alongside the legacy `window_supported`. The registry prefers `windows_supported` when present, falls back to `window_supported`, and preserves `validate_metric_key` behavior. Scenario pack loading aggregates missing keys for pass/expected rules and emits a single ValidationError that includes the full missing key list, then prevents guided mode from continuing.

**Tech Stack:** Python (FastAPI backend), JSON catalog, pytest or simple Python script for demonstration.

---

## Parallel Task Graph

- **T1 Inspect existing validation flow**
- **T2 Extend metric catalog fields**
- **T3 Implement registry + validation changes** (depends on T1, T2)
- **T4 Add demo script** (depends on T3)
- **T5 Verification** (depends on T3, T4)

## Files (planned)

- Modify: `services/engine/core/metrics_catalog.json`
- Modify: `services/engine/core/metrics_registry.py`
- Modify: `services/engine/core/scenario_pack_loader.py`
- Create: `scripts/demo_missing_metric_validation.py`
- Create: `docs/plans/2026-01-30-metric-registry-validation.md`

## Success Criteria

- Metric catalog includes >=8 existing metrics (e.g., `drg.quota.used`, `drg.quota.total`, `dip.point_value`, `dip.quota.used`), and each entry has `windows_supported` alongside any existing `window_supported`.
- Missing metric keys from `pass_condition.metric` or `expected_rules.metric` produce a single validation error that includes all missing keys in one message (e.g., `缺少指标键: abc, xyz`).
- Guided mode is blocked when missing metrics are detected.
- Demo script shows the error using a fake missing key, loading from a temporary scenario pack directory without changing formal scenario files.

## Task 1: Inspect existing validation flow

**Files:**
- Read: `services/engine/core/metrics_registry.py`
- Read: `services/engine/core/scenario_pack_loader.py`
- Search: guided mode usage (likely in loader or engine)

**Step 1: Read registry and loader**

Run: `Read services/engine/core/metrics_registry.py`
Expected: `load_metrics_catalog()` and `validate_metric_key()` present.

**Step 2: Find guided mode handling**

Run: `Grep pattern="guided" include="*.py" path="services"`
Expected: One or more references to guided mode or related flags.

**Step 3: Note validation error shape**

Confirm how `ValidationError` is constructed and consumed.

## Task 2: Extend metric catalog fields

**Files:**
- Modify: `services/engine/core/metrics_catalog.json`

**Step 1: Add `windows_supported` to existing metrics**

- Do NOT replace existing keys.
- For each metric, add `windows_supported` (plural), using the same values as `window_supported` where present.
- Ensure there are at least 8 metrics total; use current DRG/DIP keys such as `drg.quota.used`, `drg.quota.total`, `dip.point_value`, `dip.quota.used`.

**Step 2: Validate JSON format**

Run: `python -m json.tool services/engine/core/metrics_catalog.json`
Expected: No errors.

## Task 3: Implement registry + validation changes

**Files:**
- Modify: `services/engine/core/metrics_registry.py`
- Modify: `services/engine/core/scenario_pack_loader.py`

**Step 1: Update catalog schema**

Ensure `load_metrics_catalog()` returns metrics with `windows_supported` and falls back to legacy `window_supported` when `windows_supported` is missing.

**Step 2: Improve validation to return missing list**

Implement a helper that returns a list of missing metric keys (deduplicated, stable order).

Pseudo-code target:

```python
def find_missing_metric_keys(keys: Iterable[str]) -> List[str]:
    catalog = load_metrics_catalog()
    missing = [k for k in keys if k and k not in catalog]
    return sorted(set(missing), key=missing.index)
```

**Step 3: Aggregate missing keys in loader**

- Gather keys from `pass_condition.metric` and `expected_rules.metric`.
- Call the new helper, then append one ValidationError with message `"缺少指标键: <list>"`.
- If any missing keys exist, ensure guided mode is blocked (based on actual flag/flow found in Task 1).

**Step 4: Preserve existing validate behavior**

Keep `validate_metric_key()` behavior unchanged; it can call the new helper internally if needed.

## Task 4: Add demo script

**Files:**
- Create: `scripts/demo_missing_metric_validation.py`

**Step 1: Create a fake minimal scenario structure**

Create a temporary scenario pack directory and write a minimal scenario file the loader accepts, then instantiate `ScenarioPackLoader` pointing at that temp dir.

- `pass_condition.metric = "not_in_catalog"`
- `expected_rules = [{"metric":"drg.quota.used"}, {"metric":"missing_metric"}]`

**Step 2: Call loader and print errors**

Expected output should include:

```
缺少指标键: not_in_catalog, missing_metric
```

**Step 3: Document how to run**

Run: `python scripts/demo_missing_metric_validation.py`
Expected: exit code non-zero or printed validation errors.

## Task 5: Verification

**Step 1: Run demo script**

Run: `python scripts/demo_missing_metric_validation.py`
Expected: error includes full missing key list.

**Step 2 (optional): Run tests if present**

Run: `pytest -q`
Expected: PASS (if test suite exists).

---

## Test Plan (summary)

- Validate JSON catalog formatting with `python -m json.tool`.
- Demo script to verify missing key error aggregation and guided mode blocking.
- Run existing test suite if available.
