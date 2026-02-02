import json
import sys
import tempfile
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(repo_root / "services" / "engine"))

    from core.scenario_pack_loader import ScenarioPackLoader  # type: ignore[import-not-found]

    pack_data = {
        "id": "demo_missing_metric",
        "title": "Missing metric validation demo",
        "timebox_minutes": 5,
        "learning_objective": "Demonstrate missing metric validation",
        "region_id": "demo_region",
        "seed": 42,
        "initial_params": {},
        "policy_version_tag": "v1",
        "steps": [
            {
                "step_id": "step-1",
                "instruction": "Advance one step.",
                "action": {"type": "advance", "payload": {}},
                "expected_observation": ["obs a", "obs b"],
                "expected_rules": [
                    {"metric": "drg.quota.used", "operator": ">", "threshold": 0},
                    {"metric": "missing_metric", "operator": ">", "threshold": 0},
                ],
                "pass_condition": {
                    "metric": "not_in_catalog",
                    "operator": ">",
                    "threshold": 0,
                },
                "explain_check": {
                    "question": "Why is this step needed?",
                    "options": ["Option A", "Option B"],
                    "correct_option_index": 0,
                    "rationale": "Because this is a demo.",
                },
            }
        ],
        "completion": {
            "export_required": True,
            "artifacts": ["results.csv"],
            "summary_template": "Done.",
        },
    }

    with tempfile.TemporaryDirectory() as temp_dir:
        pack_path = Path(temp_dir) / "demo_missing_metric.json"
        with open(pack_path, "w", encoding="utf-8") as handle:
            json.dump(pack_data, handle, ensure_ascii=True, indent=2)

        loader = ScenarioPackLoader(temp_dir)
        _, errors = loader.load_all()

        if errors:
            for error in errors:
                for message in error.errors:
                    print(message)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
