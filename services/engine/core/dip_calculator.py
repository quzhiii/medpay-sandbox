"""
DIP 支付计算器
公式:
  point_value = budget / region_total_points
  region_total_points = hospital_points * multiplier + external_points
  pay = points * point_value * adjustment + addon

特例单议策略:
  - uplift: pay = pay * uplift_rate
  - ffspay: pay = cost * ffspay_rate
"""

from dataclasses import dataclass
from typing import Optional, Literal

from models.schemas import RegionPack, Case


@dataclass
class PointValueBreakdown:
    """点值分解"""

    budget: float  # 预算总额
    hospital_points: float  # 本院点数
    multiplier: float  # 本院点数乘数
    external_points: float  # 区域外点数
    region_total_points: float  # 区域总点数
    point_value: float  # 点单价

    def to_dict(self) -> dict:
        return {
            "budget": self.budget,
            "hospital_points": self.hospital_points,
            "multiplier": self.multiplier,
            "external_points": self.external_points,
            "region_total_points": self.region_total_points,
            "point_value": round(self.point_value, 4),
        }


@dataclass
class DIPPaymentResult:
    """DIP 支付计算结果"""

    payment: float  # 支付金额
    points: float  # 病例点数
    point_value: float  # 点单价
    adjustment_multiplier: float  # 调节系数
    addon: float  # 附加支付
    is_special_case: bool  # 是否特例单议
    special_strategy: Optional[str]  # 特例单议策略
    cost: float  # 病例成本
    margin: float  # 利润
    margin_rate: float  # 利润率

    # 点值分解
    point_value_breakdown: PointValueBreakdown

    # 计算分解
    base_payment: float  # 基础支付 = points * point_value
    adjusted_payment: float  # 调整后支付
    normal_payment: float  # 普通结算金额（用于计算管理效应）


class DIPCalculator:
    """DIP 支付计算器"""

    def __init__(self, region_pack: RegionPack, budget: float):
        """
        Args:
            region_pack: 地区规则包
            budget: 本次仿真预算
        """
        self.region_pack = region_pack
        self.config = region_pack.dip
        self.budget = budget

        # 从配置读取点值模型参数
        self.multiplier = self.config.point_value_model.multiplier
        self.external_points_base = self.config.point_value_model.external_points_base

    def calculate_point_value(
        self,
        hospital_points: float,
        external_points: Optional[float] = None,
    ) -> PointValueBreakdown:
        """
        计算点值

        Args:
            hospital_points: 本院累计点数
            external_points: 区域外点数（默认使用配置基数）

        Returns:
            PointValueBreakdown
        """
        if external_points is None:
            external_points = self.external_points_base

        # 区域总点数 = 本院点数 * 乘数 + 区域外点数
        region_total_points = hospital_points * self.multiplier + external_points

        # 点单价 = 预算 / 区域总点数
        point_value = (
            self.budget / region_total_points if region_total_points > 0 else 0
        )

        return PointValueBreakdown(
            budget=self.budget,
            hospital_points=hospital_points,
            multiplier=self.multiplier,
            external_points=external_points,
            region_total_points=round(region_total_points, 2),
            point_value=point_value,
        )

    def calculate(
        self,
        case: Case,
        hospital_total_points: float,
        external_points: Optional[float] = None,
        adjustment: float = 1.0,
        addon: float = 0,
        is_special_case: bool = False,
        special_strategy: Literal["uplift", "ffspay"] = "uplift",
        special_uplift: float = 1.0,
        ffspay_rate: float = 0.85,
    ) -> DIPPaymentResult:
        """
        计算 DIP 支付

        Args:
            case: 病例
            hospital_total_points: 本院累计总点数
            external_points: 区域外点数
            adjustment: 调节系数
            addon: 附加支付
            is_special_case: 是否特例单议
            special_strategy: 特例单议策略 (uplift/ffspay)
            special_uplift: 特例单议上浮比例
            ffspay_rate: 按项目付费比例

        Returns:
            DIPPaymentResult
        """
        points = case.dip_points
        cost = case.cost

        # 计算点值（考虑本病例的点数）
        total_points_with_case = hospital_total_points + points
        breakdown = self.calculate_point_value(total_points_with_case, external_points)
        point_value = breakdown.point_value

        # 基础支付
        base_payment = points * point_value

        # 调整后支付
        adjusted_payment = base_payment * adjustment

        # 普通结算金额（不含特例单议）
        normal_payment = adjusted_payment + addon

        # 应用特例单议策略
        if is_special_case:
            if special_strategy == "ffspay":
                # 按项目付费：按实际费用的一定比例支付
                actual_cost = (
                    case.special_case_cost if case.special_case_cost > 0 else cost
                )
                payment = actual_cost * ffspay_rate + addon
            else:  # uplift
                # 上浮策略：在普通支付基础上乘以上浮系数
                payment = normal_payment * special_uplift
        else:
            payment = normal_payment

        # 利润计算
        margin = payment - cost
        margin_rate = margin / cost if cost > 0 else 0

        return DIPPaymentResult(
            payment=round(payment, 2),
            points=points,
            point_value=round(point_value, 4),
            adjustment_multiplier=adjustment,
            addon=addon,
            is_special_case=is_special_case,
            special_strategy=special_strategy if is_special_case else None,
            cost=cost,
            margin=round(margin, 2),
            margin_rate=round(margin_rate, 4),
            point_value_breakdown=breakdown,
            base_payment=round(base_payment, 2),
            adjusted_payment=round(adjusted_payment, 2),
            normal_payment=round(normal_payment, 2),
        )
