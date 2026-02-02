"""
解释器模块
负责对支付变动进行归因分析
"""

from models.schemas import Explanation, Decomposition
from core.drg_calculator import DRGPaymentResult
from core.dip_calculator import DIPPaymentResult


class Explainer:
    """归因解释器"""

    def __init__(self, dip_standard_point_value: float = 1.0):
        self.dip_standard_point_value = dip_standard_point_value

    def explain(
        self, drg_result: DRGPaymentResult, dip_result: DIPPaymentResult
    ) -> Explanation:
        """生成解释"""
        return Explanation(
            delta_total_pay_drg=drg_result.payment,
            decomp_drg=self._explain_drg(drg_result),
            delta_total_pay_dip=dip_result.payment,
            decomp_dip=self._explain_dip(dip_result),
        )

    def _explain_drg(self, result: DRGPaymentResult) -> Decomposition:
        """DRG 归因"""
        # 结构因素：标准状态下的支付能力 (权重 * 基础费率 * 调节系数)
        # 这代表了收治该病种的"应得"收入
        structural = result.weight * result.base_rate * result.adjustment_multiplier

        # 价格因素：对于固定费率的 DRG，价格因素通常为 0
        # 除非我们引入了费率调整机制
        price = 0.0

        # 管理因素：实际支付与标准支付的差额
        # 包括：特例单议上浮、极高费用追加、按项目付费差异等
        # Management = Total - Structural - Price
        management = result.payment - structural - price

        return Decomposition(
            structural=round(structural, 2),
            price=round(price, 2),
            management=round(management, 2),
        )

    def _explain_dip(self, result: DIPPaymentResult) -> Decomposition:
        """DIP 归因"""
        # 结构因素：假设点值维持在标准值(1.0)时的收入
        # Structural = Points * Std_PV * Adj
        structural = (
            result.points * self.dip_standard_point_value * result.adjustment_multiplier
        )

        # 价格因素：点值波动带来的损益 (囚徒困境效应)
        # Price = Points * (Actual_PV - Std_PV) * Adj
        # 如果点值 < 1.0，这里是负值，直观反映"贬值"损失
        price_delta = result.point_value - self.dip_standard_point_value
        price = result.points * price_delta * result.adjustment_multiplier

        # 管理因素：特例单议、附加支付等
        # Management = Total - (Structural + Price)
        # 注意：Structural + Price = Points * Actual_PV * Adj = adjusted_payment (无特例时)
        # 所以 Management 基本上等于 payment - adjusted_payment
        management = result.payment - (structural + price)

        return Decomposition(
            structural=round(structural, 2),
            price=round(price, 2),
            management=round(management, 2),
        )
