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


def test_last_settle_missing_cost_and_point_value_have_reasons():
    state = ScenarioState(params=ScenarioParams(region_id="test"))
    event = Event(
        ts="Day1-morning-002",
        type="SETTLE",
        payload={},
        delta=EventDelta(pay_drg=10, pay_dip=5, margin_drg=2, margin_dip=1),
    )
    scenario = SimpleNamespace(state=state, events=[event])

    metrics, reasons = _compute_metrics(scenario, "last_settle")

    assert metrics["drg.cost_total"] is None
    assert metrics["dip.cost_total"] is None
    assert metrics["dip.point_value"] is None
    assert reasons["drg.cost_total"]
    assert reasons["dip.cost_total"]
    assert reasons["dip.point_value"]
    assert reasons["drg.margin_rate"]
    assert reasons["dip.margin_rate"]


def test_day_missing_cost_returns_null_with_reason():
    state = ScenarioState(params=ScenarioParams(region_id="test"), current_day=1)
    event = Event(
        ts="Day1-morning-001",
        type="SETTLE",
        payload={},
        delta=EventDelta(pay_drg=10, pay_dip=5, margin_drg=2, margin_dip=1),
    )
    scenario = SimpleNamespace(state=state, events=[event])

    metrics, reasons = _compute_metrics(scenario, "day")

    assert metrics["drg.cost_total"] is None
    assert metrics["dip.cost_total"] is None
    assert reasons["drg.cost_total"]
    assert reasons["dip.cost_total"]
    assert reasons["drg.margin_rate"]
    assert reasons["dip.margin_rate"]
