"""
ScenarioPack 加载器
负责从 data/scenarios 目录加载和校验 YAML/JSON 文件
"""

import logging
from pathlib import Path
from typing import Optional

import yaml
from pydantic import ValidationError as PydanticValidationError

from models.schemas import ScenarioPack, ScenarioPackSummary, ValidationError
from core.metrics_registry import find_missing_metric_keys

logger = logging.getLogger(__name__)


class ScenarioPackLoader:
    """情景包加载器"""

    def __init__(self, packs_dir: str | Path):
        self.packs_dir = Path(packs_dir)
        self._cache: dict[str, ScenarioPack] = {}
        self._errors: list[ValidationError] = []

    def load_all(self) -> tuple[list[ScenarioPack], list[ValidationError]]:
        """加载所有情景包，返回 (成功列表, 错误列表)"""
        self._cache.clear()
        self._errors.clear()

        if not self.packs_dir.exists():
            logger.warning(f"情景包目录不存在: {self.packs_dir}")
            return [], []

        for file_path in self.packs_dir.iterdir():
            if file_path.suffix in (".yml", ".yaml", ".json"):
                self._load_file(file_path)

        return list(self._cache.values()), self._errors

    def _load_file(self, file_path: Path) -> Optional[ScenarioPack]:
        """加载单个文件"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                if file_path.suffix == ".json":
                    import json

                    data = json.load(f)
                else:
                    data = yaml.safe_load(f)

            if not data:
                self._add_error(file_path.stem, str(file_path), ["文件为空或格式无效"])
                return None

            pack = ScenarioPack.model_validate(data)
            missing_keys = self._validate_pack_metrics(pack)
            if missing_keys:
                self._add_error(
                    file_path.stem,
                    str(file_path),
                    [f"缺少指标键: {', '.join(missing_keys)}"],
                )
                return None
            self._cache[pack.id] = pack
            logger.info(f"成功加载情景包: {pack.id} ({pack.title})")
            return pack

        except PydanticValidationError as e:
            errors = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
            self._add_error(file_path.stem, str(file_path), errors)
            logger.error(f"情景包校验失败 {file_path}: {errors}")
            return None

        except yaml.YAMLError as e:
            self._add_error(file_path.stem, str(file_path), [f"YAML 解析错误: {e}"])
            logger.error(f"YAML 解析错误 {file_path}: {e}")
            return None

        except Exception as e:
            self._add_error(file_path.stem, str(file_path), [f"未知错误: {e}"])
            logger.error(f"加载情景包失败 {file_path}: {e}")
            return None

    def _add_error(self, pack_id: str, file_path: str, errors: list[str]):
        self._errors.append(
            ValidationError(pack_id=pack_id, file_path=file_path, errors=errors)
        )

    def get_pack(self, pack_id: str) -> Optional[ScenarioPack]:
        return self._cache.get(pack_id)

    def get_all_packs(self) -> list[ScenarioPack]:
        return list(self._cache.values())

    def get_summaries(self) -> list[ScenarioPackSummary]:
        summaries = []
        for pack in self._cache.values():
            summaries.append(
                ScenarioPackSummary(
                    id=pack.id,
                    title=pack.title,
                    timebox_minutes=pack.timebox_minutes,
                    learning_objective=pack.learning_objective,
                    region_id=pack.region_id,
                    policy_version_tag=pack.policy_version_tag,
                )
            )
        return summaries

    def get_errors(self) -> list[ValidationError]:
        return self._errors

    def _validate_pack_metrics(self, pack: ScenarioPack) -> list[str]:
        metric_keys = []
        for step in pack.steps:
            metric_keys.append(step.pass_condition.metric)
            for rule in step.expected_rules or []:
                metric_keys.append(rule.metric)
            for trigger in step.required_triggers or []:
                metric_keys.append(trigger.metric)
        return find_missing_metric_keys(metric_keys)


_scenario_loader: Optional[ScenarioPackLoader] = None


def get_scenario_loader() -> ScenarioPackLoader:
    global _scenario_loader
    if _scenario_loader is None:
        base_dir = Path(__file__).parent.parent.parent.parent
        packs_dir = base_dir / "data" / "scenarios"
        _scenario_loader = ScenarioPackLoader(packs_dir)
        _scenario_loader.load_all()
    return _scenario_loader


def reload_scenario_packs() -> tuple[list[ScenarioPack], list[ValidationError]]:
    loader = get_scenario_loader()
    return loader.load_all()
