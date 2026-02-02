"""
病例生成器
使用确定性随机数生成器，保证 seed 可复现
"""

import random
from typing import Literal

from models.schemas import Case, SeverityLevel


# 骨科 DRG 分组映射（演示用）
ORTHO_DRG_GROUPS = [
    {
        "group_id": "IC19",
        "name": "髋关节置换术",
        "weight": 3.2,
        "points": 320,
        "cost_base": 45000,
    },
    {
        "group_id": "IC21",
        "name": "膝关节置换术",
        "weight": 2.8,
        "points": 280,
        "cost_base": 38000,
    },
    {
        "group_id": "ID11",
        "name": "脊柱融合术",
        "weight": 4.5,
        "points": 450,
        "cost_base": 65000,
    },
    {
        "group_id": "IB13",
        "name": "骨折内固定术",
        "weight": 1.8,
        "points": 180,
        "cost_base": 22000,
    },
    {
        "group_id": "IB15",
        "name": "关节镜手术",
        "weight": 1.2,
        "points": 120,
        "cost_base": 15000,
    },
    {
        "group_id": "IA11",
        "name": "骨科保守治疗",
        "weight": 0.6,
        "points": 60,
        "cost_base": 6000,
    },
]

# 严重程度分布（累积概率）
SEVERITY_DISTRIBUTION = [
    (0.4, 1),  # 40% 轻症
    (0.75, 2),  # 35% 中等
    (0.92, 3),  # 17% 重症
    (1.0, 4),  # 8% 危重
]


class CaseGenerator:
    """病例生成器（seed 可复现）"""

    def __init__(
        self,
        seed: int,
        aggressiveness: float = 0.5,
        candidate_rate: float | None = None,
    ):
        """
        Args:
            seed: 随机种子
            aggressiveness: 激进程度 0.0-1.0，影响特例单议候选命中率
        """
        self.seed = seed
        self.rng = random.Random(seed)
        self.case_counter = 0
        self.aggressiveness = max(0.0, min(1.0, aggressiveness))  # 限制在 [0, 1]
        self.candidate_rate = candidate_rate

    def reset(self, seed: int | None = None):
        """重置生成器"""
        if seed is not None:
            self.seed = seed
        self.rng = random.Random(self.seed)
        self.case_counter = 0

    def set_aggressiveness(self, aggressiveness: float):
        """设置激进程度"""
        self.aggressiveness = max(0.0, min(1.0, aggressiveness))

    def set_candidate_rate(self, candidate_rate: float | None):
        """设置特例候选比例（强制）"""
        if candidate_rate is None:
            self.candidate_rate = None
            return
        self.candidate_rate = max(0.0, min(1.0, float(candidate_rate)))

    def generate_case(self, day: int) -> Case:
        """生成一个病例"""
        self.case_counter += 1

        # 选择 DRG 分组
        group = self.rng.choice(ORTHO_DRG_GROUPS)

        # 生成严重程度
        severity = self._generate_severity()

        # 根据严重程度调整费用和权重
        severity_multiplier = 1 + (severity - 1) * 0.3
        cost = (
            group["cost_base"] * severity_multiplier * (0.8 + self.rng.random() * 0.4)
        )
        weight = group["weight"] * (0.9 + self.rng.random() * 0.2)
        points = group["points"] * (0.9 + self.rng.random() * 0.2)

        # 住院天数
        los = max(1, int(3 + severity * 2 + self.rng.gauss(0, 2)))

        # 特例单议候选判定（考虑激进程度）
        if self.candidate_rate is not None:
            special_case_candidate = self.rng.random() < self.candidate_rate
        else:
            special_case_candidate = self._evaluate_special_candidate(
                severity, cost, group["cost_base"]
            )

        # 特例单议实际费用（通常高于标准费用）
        special_case_cost = (
            cost * (1.1 + self.rng.random() * 0.3) if special_case_candidate else 0
        )

        return Case(
            case_id=f"CASE-{day:02d}-{self.case_counter:04d}",
            dept="Ortho",
            severity_level=severity,
            group_id=group["group_id"],
            drg_weight=round(weight, 2),
            dip_points=round(points, 1),
            cost=round(cost, 2),
            los=los,
            special_case_candidate=special_case_candidate,
            special_case_cost=round(special_case_cost, 2),
            status="arrived",
            arrival_day=day,
        )

    def _evaluate_special_candidate(
        self, severity: int, cost: float, cost_base: float
    ) -> bool:
        """
        评估是否为特例单议候选

        Args:
            severity: 严重程度
            cost: 实际费用
            cost_base: 基准费用

        Returns:
            是否为特例单议候选
        """
        # 基础概率因素
        base_prob = 0.0

        # 危重病例（severity=4）基础概率较高
        if severity >= 4:
            base_prob += 0.3
        elif severity >= 3:
            base_prob += 0.1

        # 高费用病例
        cost_ratio = cost / cost_base
        if cost_ratio > 2.5:
            base_prob += 0.4
        elif cost_ratio > 1.8:
            base_prob += 0.2
        elif cost_ratio > 1.3:
            base_prob += 0.1

        # 随机因素
        random_component = 0.05  # 基础随机概率

        # 激进程度影响：保守时降低概率，激进时提高概率
        # aggressiveness=0 时，最终概率 = base_prob * 0.3
        # aggressiveness=0.5 时，最终概率 = base_prob * 1.0
        # aggressiveness=1.0 时，最终概率 = base_prob * 2.0
        aggr_multiplier = 0.3 + self.aggressiveness * 1.7

        final_prob = (base_prob + random_component) * aggr_multiplier

        return self.rng.random() < final_prob

    def _generate_severity(self) -> SeverityLevel:
        """生成严重程度"""
        r = self.rng.random()
        for threshold, level in SEVERITY_DISTRIBUTION:
            if r <= threshold:
                return level  # type: ignore
        return 2  # type: ignore

    def generate_batch(self, day: int, count: int) -> list[Case]:
        """生成一批病例"""
        return [self.generate_case(day) for _ in range(count)]
