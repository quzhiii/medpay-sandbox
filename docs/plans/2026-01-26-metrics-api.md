# Metrics API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure `/scenario/{id}/metrics` returns required DRG/DIP metrics with correct null handling and missing reasons, especially for `last_settle` window.

**Architecture:** Keep metrics computation in `services/engine/main.py` and add small helpers for ratio/missing handling. Add focused pytest coverage that exercises `_compute_metrics` with controlled scenario/state/event data.

**Tech Stack:** Python 3.10+, FastAPI, Pydantic, pytest.

---

### Task 1: Add failing tests for required keys and missing handling

**Files:**
- Create: `services/engine/tests/test_metrics_api.py`

**Step 1: Write the failing test**

```python
from types import SimpleNamespace

from main import _compute_metrics
from models.schemas import Event, EventDelta, ScenarioParams, ScenarioState


def test_last_settle_required_keys_present_and_missing_quota_handling():
    state = ScenarioState(params=ScenarioParams(region_id="test"))
    event = Event(
        ts="Day1-morning-001",
        type="SETTLE",
        payload={"cost": 100.0, "point_value": 1.2},
        delta=EventDelta(pay_drg=10, pay_dip=5, margin_drg=2, margin_dip=1),
    )
    scenario = SimpleNamespace(state=state, events=[event])

    metrics, reasons = _compute_metrics(scenario, "last_settle")

    required_keys = [
        "drg.quota.used",
        "drg.quota.max",
        "drg.quota.ratio",
        "drg.management_effect",
        "dip.quota.used",
        "dip.quota.max",
        "dip.quota.ratio",
        "dip.management_effect",
        "dip.point_value",
        "drg.pay_total",
        "drg.cost_total",
        "drg.margin_total",
        "drg.margin_rate",
        "dip.pay_total",
        "dip.cost_total",
        "dip.margin_total",
        "dip.margin_rate",
    ]
    for key in required_keys:
        assert key in metrics

    assert metrics["drg.quota.used"] is None
    assert metrics["drg.quota.max"] is None
    assert metrics["drg.quota.ratio"] is None
    assert metrics["dip.quota.used"] is None
    assert metrics["dip.quota.max"] is None
    assert metrics["dip.quota.ratio"] is None
    assert reasons["drg.quota.used"]
    assert reasons["drg.quota.max"]
    assert reasons["drg.quota.ratio"]
    assert reasons["dip.quota.used"]
    assert reasons["dip.quota.max"]
    assert reasons["dip.quota.ratio"]
```

**Step 2: Run test to verify it fails**

Run: `pytest services/engine/tests/test_metrics_api.py -q`
Expected: FAIL with missing reasons or non-null values.

**Step 3: Commit**

Skip unless user explicitly requests a commit.

---

### Task 2: Implement missing handling and ratio helper

**Files:**
- Modify: `services/engine/main.py`

**Step 1: Write minimal implementation**

```python
def quota_ratio(used: float | None, max_value: float | None) -> tuple[float | None, str | None]:
    if max_value is None:
        return None, "缺少字段 quota_max"
    if used is None:
        return None, "缺少字段 quota_used"
    if max_value == 0:
        return None, "额度上限为 0"
    return used / max_value, None
```

Integrate this helper to set `drg.quota.*` and `dip.quota.*` for all windows, and provide specific missing reasons when payload fields are absent.

**Step 2: Run tests to verify they pass**

Run: `pytest services/engine/tests/test_metrics_api.py -q`
Expected: PASS.

**Step 3: Commit**

Skip unless user explicitly requests a commit.

---

### Task 3: Verification sweep

**Files:**
- Modify: `services/engine/main.py`
- Modify: `services/engine/tests/test_metrics_api.py`

**Step 1: Run LSP diagnostics**

Run: `lsp_diagnostics` on `services/engine/main.py` and `services/engine/tests/test_metrics_api.py`
Expected: no errors.

**Step 2: Commit**

Skip unless user explicitly requests a commit.
