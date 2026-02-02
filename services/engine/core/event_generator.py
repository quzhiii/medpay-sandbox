"""
事件生成器
根据病例状态生成对应事件
"""

import random
from typing import Literal, Optional

from models.schemas import Event, EventDelta, Case, BatchPeriod, EventType, Explanation


# 事件描述模板
EVENT_DESCRIPTIONS = {
    "ARRIVAL": "患者 {case_id} 到达骨科门诊，初诊为 {group_id}",
    "ADMIT": "患者 {case_id} 办理入院，严重程度: {severity}级",
    "PROCEDURE": "患者 {case_id} 进行手术/治疗，预估费用 ¥{cost:.0f}",
    "DISCHARGE": "患者 {case_id} 出院，住院 {los} 天，总费用 ¥{cost:.0f}",
    "GROUPING": "病例 {case_id} 入组: {group_id}，DRG权重={weight:.2f}，DIP分值={points:.1f}",
    "SETTLE": "病例 {case_id} 结算完成，DRG支付=¥{pay_drg:.0f}，DIP支付=¥{pay_dip:.0f}",
}


class EventGenerator:
    """事件生成器（seed 可复现）"""

    def __init__(self, seed: int):
        self.seed = seed
        self.rng = random.Random(seed)
        self.event_counter = 0

    def reset(self, seed: int | None = None):
        """重置生成器"""
        if seed is not None:
            self.seed = seed
        self.rng = random.Random(self.seed)
        self.event_counter = 0

    def _make_ts(self, day: int, batch: BatchPeriod, seq: int) -> str:
        """生成时间戳"""
        return f"Day{day}-{batch}-{seq:03d}"

    def _next_seq(self) -> int:
        """获取下一个序号"""
        self.event_counter += 1
        return self.event_counter

    def generate_arrival(self, case: Case, day: int, batch: BatchPeriod) -> Event:
        """生成到达事件"""
        return Event(
            ts=self._make_ts(day, batch, self._next_seq()),
            type="ARRIVAL",
            case_id=case.case_id,
            payload={
                "group_id": case.group_id,
                "severity_level": case.severity_level,
            },
            delta=EventDelta(cases_count=1),
            description=EVENT_DESCRIPTIONS["ARRIVAL"].format(
                case_id=case.case_id,
                group_id=case.group_id,
            ),
        )

    def generate_admit(self, case: Case, day: int, batch: BatchPeriod) -> Event:
        """生成入院事件"""
        return Event(
            ts=self._make_ts(day, batch, self._next_seq()),
            type="ADMIT",
            case_id=case.case_id,
            payload={
                "severity_level": case.severity_level,
                "expected_los": case.los,
            },
            delta=EventDelta(inpatients=1),
            description=EVENT_DESCRIPTIONS["ADMIT"].format(
                case_id=case.case_id,
                severity=case.severity_level,
            ),
        )

    def generate_procedure(self, case: Case, day: int, batch: BatchPeriod) -> Event:
        """生成诊疗事件"""
        return Event(
            ts=self._make_ts(day, batch, self._next_seq()),
            type="PROCEDURE",
            case_id=case.case_id,
            payload={
                "cost": case.cost,
                "group_id": case.group_id,
            },
            delta=EventDelta(total_cost=case.cost),
            description=EVENT_DESCRIPTIONS["PROCEDURE"].format(
                case_id=case.case_id,
                cost=case.cost,
            ),
        )

    def generate_discharge(self, case: Case, day: int, batch: BatchPeriod) -> Event:
        """生成出院事件"""
        return Event(
            ts=self._make_ts(day, batch, self._next_seq()),
            type="DISCHARGE",
            case_id=case.case_id,
            payload={
                "los": case.los,
                "cost": case.cost,
            },
            delta=EventDelta(inpatients=-1),
            description=EVENT_DESCRIPTIONS["DISCHARGE"].format(
                case_id=case.case_id,
                los=case.los,
                cost=case.cost,
            ),
        )

    def generate_grouping(self, case: Case, day: int, batch: BatchPeriod) -> Event:
        """生成入组事件"""
        return Event(
            ts=self._make_ts(day, batch, self._next_seq()),
            type="GROUPING",
            case_id=case.case_id,
            payload={
                "group_id": case.group_id,
                "drg_weight": case.drg_weight,
                "dip_points": case.dip_points,
            },
            delta=EventDelta(
                total_weight=case.drg_weight,
                total_points=case.dip_points,
            ),
            description=EVENT_DESCRIPTIONS["GROUPING"].format(
                case_id=case.case_id,
                group_id=case.group_id,
                weight=case.drg_weight,
                points=case.dip_points,
            ),
        )

    def generate_settle(
        self,
        case: Case,
        day: int,
        batch: BatchPeriod,
        pay_drg: float,
        pay_dip: float,
        is_special: bool = False,
        margin_drg: float = 0,
        margin_dip: float = 0,
        point_value: float = 0,
        point_value_breakdown: Optional[dict] = None,
        explanation: Optional[Explanation] = None,
        quota_used_drg: Optional[int] = None,
        quota_used_dip: Optional[int] = None,
        quota_max_drg: Optional[int] = None,
        quota_max_dip: Optional[int] = None,
    ) -> Event:
        """生成结算事件"""
        delta = EventDelta(
            pay_drg=pay_drg,
            pay_dip=pay_dip,
            margin_drg=margin_drg,
            margin_dip=margin_dip,
        )
        if is_special:
            delta.special_cases_count = 1

        payload = {
            "pay_drg": pay_drg,
            "pay_dip": pay_dip,
            "is_special_case": is_special,
            "cost": case.cost,
            "margin_drg": margin_drg,
            "margin_dip": margin_dip,
            "point_value": round(point_value, 4),
        }
        if quota_used_drg is not None:
            payload["quota_used_drg"] = quota_used_drg
        if quota_used_dip is not None:
            payload["quota_used_dip"] = quota_used_dip
        if quota_max_drg is not None:
            payload["quota_max_drg"] = quota_max_drg
        if quota_max_dip is not None:
            payload["quota_max_dip"] = quota_max_dip
        if point_value_breakdown:
            payload["point_value_breakdown"] = point_value_breakdown

        return Event(
            ts=self._make_ts(day, batch, self._next_seq()),
            type="SETTLE",
            case_id=case.case_id,
            payload=payload,
            delta=delta,
            explanation=explanation,
            description=EVENT_DESCRIPTIONS["SETTLE"].format(
                case_id=case.case_id,
                pay_drg=pay_drg,
                pay_dip=pay_dip,
            ),
        )
