from core.scenario_pack_loader import ScenarioPackLoader
from models.schemas import ScenarioPack


def test_required_triggers_metrics_are_validated():
    pack_data = {
        "id": "test_pack",
        "title": "Test Pack",
        "timebox_minutes": 10,
        "learning_objective": "Test",
        "region_id": "test_region",
        "seed": 1,
        "initial_params": {},
        "policy_version_tag": "v1",
        "steps": [
            {
                "step_id": "step1",
                "instruction": "Do thing",
                "action": {"type": "set_param", "payload": {}},
                "expected_observation": ["a", "b"],
                "pass_condition": {
                    "metric": "drg.pay_total",
                    "operator": ">",
                    "threshold": 0,
                },
                "required_triggers": [
                    {
                        "metric": "missing.required.trigger",
                        "operator": ">",
                        "threshold": 1,
                    }
                ],
                "explain_check": {
                    "question": "Q?",
                    "options": ["A", "B"],
                    "correct_option_index": 0,
                    "rationale": "Because",
                },
            }
        ],
        "completion": {
            "export_required": True,
            "artifacts": [],
            "summary_template": "done",
        },
    }

    pack = ScenarioPack.model_validate(pack_data)
    loader = ScenarioPackLoader("unused")

    missing = loader._validate_pack_metrics(pack)

    assert "missing.required.trigger" in missing
