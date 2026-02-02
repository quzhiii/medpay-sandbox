"""
Scenario 场景管理器
管理仿真场景的创建、推进、状态维护
"""

import json
import logging
from typing import Optional, Tuple
from datetime import datetime

from models.schemas import (
    ScenarioState,
    ScenarioParams,
    ScenarioSummary,
    Event,
    Case,
    BatchPeriod,
    StartScenarioRequest,
    StartScenarioResponse,
    StepScenarioResponse,
    RegionPack,
    SpecialCaseStrategy,
)
from core.case_generator import CaseGenerator
from core.event_generator import EventGenerator
from core.region_loader import get_loader
from core.drg_calculator import DRGCalculator
from core.dip_calculator import DIPCalculator
from core.explainer import Explainer

logger = logging.getLogger(__name__)

BATCH_SEQUENCE: list[BatchPeriod] = ["morning", "noon", "evening"]


class Scenario:
    """单个仿真场景"""

    region_pack: RegionPack  # Type hint: always set in __init__, never None
    drg_calc: DRGCalculator
    dip_calc: DIPCalculator
    explainer: Explainer

    def __init__(self, params: ScenarioParams):
        self.state = ScenarioState(params=params)
        self.events: list[Event] = []
        self.cases: dict[str, Case] = {}  # case_id -> Case
        self.active_cases: list[str] = []  # 当前住院病例

        # 初始化生成器（使用相同 seed 保证可复现，传入激进程度）
        self.case_gen = CaseGenerator(
            params.seed,
            params.special_aggressiveness,
            params.special_case_candidate_rate,
        )
        self.event_gen = EventGenerator(params.seed + 1000)  # 偏移避免重复

        # 加载地区包
        loader = get_loader()
        loaded_pack = loader.get_pack(params.region_id)
        if loaded_pack is None:
            raise ValueError(f"地区包 '{params.region_id}' 不存在")
        self.region_pack: RegionPack = loaded_pack

        # 初始化支付计算器和解释器
        self.drg_calc = DRGCalculator(self.region_pack)
        self.dip_calc = DIPCalculator(self.region_pack, params.budget)
        self.explainer = Explainer(dip_standard_point_value=1.0)

        # 初始化 DIP 点值状态
        self.state.external_points = self.dip_calc.external_points_base
        self.state.multiplier = self.dip_calc.multiplier

        # 解析特例单议参数
        self._special_strategy: SpecialCaseStrategy = params.special_strategy
        self._special_uplift = (
            params.special_uplift
            if params.special_uplift is not None
            else self.region_pack.special_case.uplift_rate
        )
        self._ffspay_rate = (
            params.ffspay_rate
            if params.ffspay_rate is not None
            else self.region_pack.special_case.ffspay_rate
        )

        logger.info(
            f"创建场景 {self.state.scenario_id}, seed={params.seed}, "
            f"region={params.region_id}, strategy={self._special_strategy}, "
            f"aggressiveness={params.special_aggressiveness}"
        )

    def step(self) -> list[Event]:
        """推进一个批次"""
        if self.state.is_finished:
            return []

        new_events: list[Event] = []
        day = self.state.current_day
        batch = self.state.current_batch

        # 根据批次类型生成不同事件
        if batch == "morning":
            # 新病例到达
            new_events.extend(self._generate_arrivals(day, batch))

        elif batch == "noon":
            # 入院 + 诊疗
            new_events.extend(self._generate_admissions(day, batch))
            new_events.extend(self._generate_procedures(day, batch))

        elif batch == "evening":
            # 出院 + 结算
            new_events.extend(self._generate_discharges(day, batch))

        # 更新状态
        for event in new_events:
            self._apply_delta(event)

        self.events.extend(new_events)

        # 推进批次
        self._advance_batch()

        return new_events

    def _generate_arrivals(self, day: int, batch: BatchPeriod) -> list[Event]:
        """生成到达事件"""
        events = []
        # 每天病例数有随机波动
        count = max(
            1, self.state.params.cases_per_day // 3 + self.case_gen.rng.randint(-2, 2)
        )

        for _ in range(count):
            case = self.case_gen.generate_case(day)
            self.cases[case.case_id] = case
            events.append(self.event_gen.generate_arrival(case, day, batch))

        return events

    def _generate_admissions(self, day: int, batch: BatchPeriod) -> list[Event]:
        """生成入院事件"""
        events = []
        # 处理今天到达的病例
        for case_id, case in self.cases.items():
            if case.status == "arrived" and case.arrival_day == day:
                case.status = "admitted"
                self.active_cases.append(case_id)
                events.append(self.event_gen.generate_admit(case, day, batch))
        return events

    def _generate_procedures(self, day: int, batch: BatchPeriod) -> list[Event]:
        """生成诊疗事件（每个住院病例每天一次）"""
        events = []
        for case_id in self.active_cases[:]:  # 复制列表避免修改问题
            case = self.cases.get(case_id)
            if case and case.status == "admitted":
                events.append(self.event_gen.generate_procedure(case, day, batch))
        return events

    def _generate_discharges(self, day: int, batch: BatchPeriod) -> list[Event]:
        """生成出院和结算事件"""
        events = []
        to_discharge = []

        for case_id in self.active_cases:
            case = self.cases.get(case_id)
            if not case:
                continue

            # 检查是否应该出院
            days_stayed = day - case.arrival_day + 1
            if days_stayed >= case.los:
                to_discharge.append(case_id)

        for case_id in to_discharge:
            case = self.cases[case_id]
            case.status = "discharged"
            case.discharge_day = day
            self.active_cases.remove(case_id)

            # 出院事件
            events.append(self.event_gen.generate_discharge(case, day, batch))

            # 入组事件
            events.append(self.event_gen.generate_grouping(case, day, batch))

            # 检查特例单议资格（分别检查 DRG 和 DIP 额度）
            is_special_drg, drg_rejected = self._check_and_apply_special_quota_drg(case)
            is_special_dip, dip_rejected = self._check_and_apply_special_quota_dip(case)

            # 结算事件（使用正式计算器）
            drg_result = self._calc_drg_payment(case, is_special_drg)
            dip_result = self._calc_dip_payment(case, is_special_dip)

            # 计算管理效应（特例单议带来的额外收益）
            if is_special_drg:
                drg_management_effect = drg_result.payment - drg_result.normal_payment
                self.state.management_effect_drg += drg_management_effect
            if is_special_dip:
                dip_management_effect = dip_result.payment - dip_result.normal_payment
                self.state.management_effect_dip += dip_management_effect

            # 统计被拒绝的特例单议申请
            if drg_rejected or dip_rejected:
                self.state.rejected_special_cases += 1

            # 生成归因解释
            explanation = self.explainer.explain(drg_result, dip_result)

            events.append(
                self.event_gen.generate_settle(
                    case=case,
                    day=day,
                    batch=batch,
                    pay_drg=drg_result.payment,
                    pay_dip=dip_result.payment,
                    is_special=is_special_drg or is_special_dip,
                    margin_drg=drg_result.margin,
                    margin_dip=dip_result.margin,
                    point_value=dip_result.point_value,
                    point_value_breakdown=dip_result.point_value_breakdown.to_dict(),
                    explanation=explanation,
                    quota_used_drg=self.state.quota_used_drg,
                    quota_used_dip=self.state.quota_used_dip,
                    quota_max_drg=self.state.quota_max_drg,
                    quota_max_dip=self.state.quota_max_dip,
                )
            )

            case.status = "settled"

        return events

    def _check_and_apply_special_quota_drg(self, case: Case) -> Tuple[bool, bool]:
        """
        检查并应用 DRG 特例单议额度

        Returns:
            (is_approved, was_rejected): 是否批准，是否因额度限制被拒绝
        """
        if not case.special_case_candidate:
            return False, False

        # 计算当前最大额度（基于已结算病例数）
        # DRG 额度: ≤5%
        quota_rate = self.region_pack.special_case.quota_rate_drg
        settled_cases = self.state.total_cases + 1  # 包含当前病例
        max_quota = max(1, int(settled_cases * quota_rate))

        self.state.quota_max_drg = max_quota

        # 检查是否超额
        if self.state.quota_used_drg < max_quota:
            self.state.quota_used_drg += 1
            self.state.special_cases_drg += 1
            return True, False
        else:
            # 超额，拒绝特例单议，按普通结算
            return False, True

    def _check_and_apply_special_quota_dip(self, case: Case) -> Tuple[bool, bool]:
        """
        检查并应用 DIP 特例单议额度

        Returns:
            (is_approved, was_rejected): 是否批准，是否因额度限制被拒绝
        """
        if not case.special_case_candidate:
            return False, False

        # 计算当前最大额度（基于已结算病例数）
        # DIP 额度: ≤5‰ (0.5%)
        quota_rate = self.region_pack.special_case.quota_rate_dip
        settled_cases = self.state.total_cases + 1  # 包含当前病例
        max_quota = max(1, int(settled_cases * quota_rate))

        self.state.quota_max_dip = max_quota

        # 检查是否超额
        if self.state.quota_used_dip < max_quota:
            self.state.quota_used_dip += 1
            self.state.special_cases_dip += 1
            return True, False
        else:
            # 超额，拒绝特例单议，按普通结算
            return False, True

    def _calc_drg_payment(self, case: Case, is_special: bool = False):
        """计算 DRG 支付（使用正式计算器）"""
        result = self.drg_calc.calculate(
            case=case,
            addon=0,
            is_special_case=is_special,
            special_strategy=self._special_strategy,
            special_uplift=self._special_uplift,
            ffspay_rate=self._ffspay_rate,
        )
        return result

    def _calc_dip_payment(self, case: Case, is_special: bool = False):
        """计算 DIP 支付（使用正式计算器）"""
        result = self.dip_calc.calculate(
            case=case,
            hospital_total_points=self.state.total_points,
            external_points=self.state.external_points,
            adjustment=1.0,
            addon=0,
            is_special_case=is_special,
            special_strategy=self._special_strategy,
            special_uplift=self._special_uplift,
            ffspay_rate=self._ffspay_rate,
        )
        # 更新点值状态
        self.state.current_point_value = result.point_value
        self.state.region_total_points = (
            result.point_value_breakdown.region_total_points
        )
        return result

    def update_params(self, params: dict):
        """更新场景参数（用于引导模式）"""
        if "budget" in params and params["budget"] is not None:
            self.state.params.budget = float(params["budget"])
            self.dip_calc.budget = float(params["budget"])

        if "external_points" in params and params["external_points"] is not None:
            self.state.external_points = float(params["external_points"])

        if "special_strategy" in params and params["special_strategy"] is not None:
            self._special_strategy = params["special_strategy"]
            self.state.params.special_strategy = params["special_strategy"]

        if (
            "special_aggressiveness" in params
            and params["special_aggressiveness"] is not None
        ):
            aggr = float(params["special_aggressiveness"])
            self.state.params.special_aggressiveness = aggr
            self.case_gen.set_aggressiveness(aggr)

        if (
            "special_case_candidate_rate" in params
            and params["special_case_candidate_rate"] is not None
        ):
            rate = float(params["special_case_candidate_rate"])
            self.state.params.special_case_candidate_rate = rate
            self.case_gen.set_candidate_rate(rate)

    def _apply_delta(self, event: Event):
        """应用事件增量到状态"""
        delta = event.delta
        self.state.total_inpatients += delta.inpatients
        self.state.total_cost += delta.total_cost
        self.state.total_weight += delta.total_weight
        self.state.total_points += delta.total_points
        self.state.pay_drg_total += delta.pay_drg
        self.state.pay_dip_total += delta.pay_dip
        self.state.margin_drg_total += delta.margin_drg
        self.state.margin_dip_total += delta.margin_dip
        self.state.total_cases += delta.cases_count
        # 注意: special_cases_drg/dip 在 _check_and_apply_special_quota 中更新

    def _advance_batch(self):
        """推进到下一个批次"""
        current_idx = BATCH_SEQUENCE.index(self.state.current_batch)
        if current_idx < len(BATCH_SEQUENCE) - 1:
            self.state.current_batch = BATCH_SEQUENCE[current_idx + 1]
        else:
            # 进入下一天
            self.state.current_day += 1
            self.state.current_batch = BATCH_SEQUENCE[0]

            if self.state.current_day > self.state.params.total_days:
                self.state.is_finished = True
                logger.info(f"场景 {self.state.scenario_id} 已完成")

    def get_summary(self) -> ScenarioSummary:
        """获取场景摘要"""
        return ScenarioSummary(
            scenario_id=self.state.scenario_id,
            region_id=self.state.params.region_id,
            seed=self.state.params.seed,
            current_day=self.state.current_day,
            current_batch=self.state.current_batch,
            total_cases=self.state.total_cases,
            total_events=len(self.events),
            is_finished=self.state.is_finished,
        )

    def export(self) -> dict:
        """导出场景数据"""
        return {
            "scenario": self.state.model_dump(),
            "events": [e.model_dump() for e in self.events],
            "cases": {k: v.model_dump() for k, v in self.cases.items()},
            "exported_at": datetime.now().isoformat(),
        }


class ScenarioManager:
    """场景管理器（内存存储）"""

    def __init__(self):
        self.scenarios: dict[str, Scenario] = {}

    def create(self, request: StartScenarioRequest) -> Scenario:
        """创建新场景"""
        params = ScenarioParams(
            region_id=request.region_id,
            seed=request.seed,
            cases_per_day=request.cases_per_day,
            budget=request.budget,
            special_strategy=request.special_strategy,
            special_uplift=request.special_uplift,
            ffspay_rate=request.ffspay_rate,
            special_aggressiveness=request.special_aggressiveness,
            special_case_candidate_rate=request.special_case_candidate_rate,
        )
        scenario = Scenario(params)
        self.scenarios[scenario.state.scenario_id] = scenario
        return scenario

    def get(self, scenario_id: str) -> Optional[Scenario]:
        """获取场景"""
        return self.scenarios.get(scenario_id)

    def delete(self, scenario_id: str) -> bool:
        """删除场景"""
        if scenario_id in self.scenarios:
            del self.scenarios[scenario_id]
            return True
        return False

    def list_all(self) -> list[ScenarioSummary]:
        """列出所有场景"""
        return [s.get_summary() for s in self.scenarios.values()]


# 全局管理器实例
_manager: Optional[ScenarioManager] = None


def get_scenario_manager() -> ScenarioManager:
    """获取全局场景管理器"""
    global _manager
    if _manager is None:
        _manager = ScenarioManager()
    return _manager
