"""
RegionPack 加载器
负责从 data/region_packs 目录加载和校验 YAML/JSON 文件
"""

import os
import logging
from pathlib import Path
from typing import Optional

import yaml
from pydantic import ValidationError as PydanticValidationError

from models.schemas import RegionPack, RegionPackSummary, ValidationError

logger = logging.getLogger(__name__)


class RegionPackLoader:
    """地区包加载器"""

    def __init__(self, packs_dir: str | Path):
        self.packs_dir = Path(packs_dir)
        self._cache: dict[str, RegionPack] = {}
        self._errors: list[ValidationError] = []

    def load_all(self) -> tuple[list[RegionPack], list[ValidationError]]:
        """加载所有地区包，返回 (成功列表, 错误列表)"""
        self._cache.clear()
        self._errors.clear()

        if not self.packs_dir.exists():
            logger.warning(f"地区包目录不存在: {self.packs_dir}")
            return [], []

        for file_path in self.packs_dir.iterdir():
            if file_path.suffix in (".yml", ".yaml", ".json"):
                self._load_file(file_path)

        return list(self._cache.values()), self._errors

    def _load_file(self, file_path: Path) -> Optional[RegionPack]:
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

            # 使用 Pydantic 校验
            pack = RegionPack.model_validate(data)
            self._cache[pack.id] = pack
            logger.info(f"成功加载地区包: {pack.id} ({pack.name})")
            return pack

        except PydanticValidationError as e:
            errors = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
            self._add_error(file_path.stem, str(file_path), errors)
            logger.error(f"地区包校验失败 {file_path}: {errors}")
            return None

        except yaml.YAMLError as e:
            self._add_error(file_path.stem, str(file_path), [f"YAML 解析错误: {e}"])
            logger.error(f"YAML 解析错误 {file_path}: {e}")
            return None

        except Exception as e:
            self._add_error(file_path.stem, str(file_path), [f"未知错误: {e}"])
            logger.error(f"加载地区包失败 {file_path}: {e}")
            return None

    def _add_error(self, pack_id: str, file_path: str, errors: list[str]):
        """添加错误记录"""
        self._errors.append(
            ValidationError(pack_id=pack_id, file_path=file_path, errors=errors)
        )

    def get_pack(self, pack_id: str) -> Optional[RegionPack]:
        """获取单个地区包"""
        return self._cache.get(pack_id)

    def get_all_packs(self) -> list[RegionPack]:
        """获取所有已加载的地区包"""
        return list(self._cache.values())

    def get_summaries(self) -> list[RegionPackSummary]:
        """获取所有地区包摘要"""
        summaries = []
        for pack in self._cache.values():
            # 统计参数来源
            source_stats = {"official": 0, "local_doc": 0, "assumption": 0}
            for source_type in pack.param_source_map.values():
                if source_type in source_stats:
                    source_stats[source_type] += 1

            summaries.append(
                RegionPackSummary(
                    id=pack.id,
                    name=pack.name,
                    region_level=pack.region_level,
                    payment_primary=pack.payment_primary,
                    policy_version=pack.policy_version,
                    source_stats=source_stats,
                )
            )

        return summaries

    def get_errors(self) -> list[ValidationError]:
        """获取加载错误列表"""
        return self._errors


# 全局加载器实例
_loader: Optional[RegionPackLoader] = None


def get_loader() -> RegionPackLoader:
    """获取全局加载器实例"""
    global _loader
    if _loader is None:
        # 默认路径：项目根目录/data/region_packs
        base_dir = Path(__file__).parent.parent.parent.parent
        packs_dir = base_dir / "data" / "region_packs"
        _loader = RegionPackLoader(packs_dir)
        _loader.load_all()
    return _loader


def reload_packs() -> tuple[list[RegionPack], list[ValidationError]]:
    """重新加载所有地区包"""
    loader = get_loader()
    return loader.load_all()
