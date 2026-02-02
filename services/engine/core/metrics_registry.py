import json
from pathlib import Path
from typing import Iterable


def load_metrics_catalog() -> dict[str, dict]:
    base_dir = Path(__file__).parent
    catalog_path = base_dir / "metrics_catalog.json"
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    for item in catalog:
        if "windows_supported" not in item and "window_supported" in item:
            item["windows_supported"] = item["window_supported"]
    return {item["key"]: item for item in catalog}


def validate_metric_key(metric_key: str, catalog: dict[str, dict]) -> bool:
    return metric_key in catalog


def find_missing_metric_keys(keys: Iterable[str]) -> list[str]:
    catalog = load_metrics_catalog()
    missing = []
    seen = set()
    for key in keys:
        if key in catalog or key in seen:
            continue
        missing.append(key)
        seen.add(key)
    return missing
