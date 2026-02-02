"""
DRG 支付计算器
公式: pay = weight * base_rate * adjustment_multiplier + addon
特例单议策略:
  - uplift: pay = pay * uplift_rate
  - ffspay: pay = cost * ffspay_rate
"""

from dataclasses import dataclass
from typing import Optional, Literal

from models.schemas import RegionPack, Case


@dataclass
class DRGPaymentResult:
    """DRG 支付计算结果"""

    payment: float  # 支付金额
    base_rate: float  # 基础费率
    weight: float  # 病例权重
    adjustment_multiplier: float  # 调节系数
    addon: float  # 附加支付
    is_outlier: bool  # 是否极高费用
    is_special_case: bool  # 是否特例单议
    special_strategy: Optional[str]  # 特例单议策略
    cost: float  # 病例成本
    margin: float  # 利润
    margin_rate: float  # 利润率

    # 计算分解
    base_payment: float  # 基础支付 = weight * base_rate
    adjusted_payment: float  # 调整后支付 = base_payment * adj
    normal_payment: float  # 普通结算金额（用于计算管理效应）


class DRGCalculator:
    """DRG 支付计算器"""

    def __init__(self, region_pack: RegionPack):
        self.region_pack = region_pack
        self.config = region_pack.drg

    def calculate(
        self,
        case: Case,
        addon: float = 0,
        is_special_case: bool = False,
        special_strategy: Literal["uplift", "ffspay"] = "uplift",
        special_uplift: float = 1.0,
        ffspay_rate: float = 0.85,
    ) -> DRGPaymentResult:
        """
        计算 DRG 支付

        Args:
            case: 病例
            addon: 附加支付（新技术、除外支付等）
            is_special_case: 是否特例单议
            special_strategy: 特例单议策略 (uplift/ffspay)
            special_uplift: 特例单议上浮比例
            ffspay_rate: 按项目付费比例

        Returns:
            DRGPaymentResult
        """
        base_rate = self.config.base_rate
        weight = case.drg_weight
        adj = self.config.adjustment_multiplier
        cost = case.cost

        # 检查极高费用病例
        outlier_threshold = base_rate * weight * self.config.outlier_multiplier
        is_outlier = cost > outlier_threshold

        # 基础支付
        base_payment = weight * base_rate

        # 调整后支付
        adjusted_payment = base_payment * adj

        # 极高费用补偿（超出部分按比例补偿）
        outlier_addon = 0
        if is_outlier:
            excess = cost - outlier_threshold
            outlier_addon = excess * 0.7  # 70% 补偿

        # 普通结算金额（不含特例单议）
        normal_payment = adjusted_payment + addon + outlier_addon

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

        return DRGPaymentResult(
            payment=round(payment, 2),
            base_rate=base_rate,
            weight=weight,
            adjustment_multiplier=adj,
            addon=addon + outlier_addon,
            is_outlier=is_outlier,
            is_special_case=is_special_case,
            special_strategy=special_strategy if is_special_case else None,
            cost=cost,
            margin=round(margin, 2),
            margin_rate=round(margin_rate, 4),
            base_payment=round(base_payment, 2),
            adjusted_payment=round(adjusted_payment, 2),
            normal_payment=round(normal_payment, 2),
        )
