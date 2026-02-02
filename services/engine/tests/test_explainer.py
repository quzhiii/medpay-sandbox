import unittest
from core.explainer import Explainer
from core.drg_calculator import DRGPaymentResult
from core.dip_calculator import DIPPaymentResult, PointValueBreakdown


class TestExplainer(unittest.TestCase):
    def setUp(self):
        self.explainer = Explainer(dip_standard_point_value=1.0)

    def test_drg_explanation_consistency(self):
        """测试 DRG 归因加总一致性"""
        # 模拟一个 DRG 支付结果
        # Base Payment = 2.0 * 10000 = 20000
        # Uplift = 1.3 -> Total = 26000
        result = DRGPaymentResult(
            payment=26000.0,
            base_rate=10000.0,
            weight=2.0,
            adjustment_multiplier=1.0,
            addon=0.0,
            is_outlier=False,
            is_special_case=True,
            special_strategy="uplift",
            cost=20000.0,
            margin=6000.0,
            margin_rate=0.3,
            base_payment=20000.0,
            adjusted_payment=20000.0,
            normal_payment=20000.0,
        )

        decomp = self.explainer._explain_drg(result)

        # 验证: structural + price + management == payment
        total_attributed = decomp.structural + decomp.price + decomp.management
        self.assertAlmostEqual(total_attributed, result.payment, places=2)

        # 验证具体的归因逻辑
        self.assertEqual(decomp.structural, 20000.0)
        self.assertEqual(decomp.price, 0.0)
        self.assertEqual(decomp.management, 6000.0)

    def test_dip_explanation_consistency(self):
        """测试 DIP 归因加总一致性"""
        # 模拟一个 DIP 支付结果
        # Points = 100
        # Actual PV = 0.8 (Standard = 1.0) -> Price Effect should be negative
        # Base Pay = 100 * 0.8 = 80
        # Uplift = 1.0 -> Total = 80
        result = DIPPaymentResult(
            payment=80.0,
            points=100.0,
            point_value=0.8,
            adjustment_multiplier=1.0,
            addon=0.0,
            is_special_case=False,
            special_strategy=None,
            cost=90.0,
            margin=-10.0,
            margin_rate=-0.11,
            point_value_breakdown=PointValueBreakdown(1000, 100, 1.0, 0, 1250, 0.8),
            base_payment=80.0,
            adjusted_payment=80.0,
            normal_payment=80.0,
        )

        decomp = self.explainer._explain_dip(result)

        # 验证加总一致性
        total_attributed = decomp.structural + decomp.price + decomp.management
        self.assertAlmostEqual(total_attributed, result.payment, places=2)

        # 验证归因逻辑
        # Structural = 100 * 1.0 = 100
        self.assertEqual(decomp.structural, 100.0)
        # Price = 100 * (0.8 - 1.0) = -20
        self.assertEqual(decomp.price, -20.0)
        # Management = 80 - (100 - 20) = 0
        self.assertEqual(decomp.management, 0.0)


if __name__ == "__main__":
    unittest.main()
