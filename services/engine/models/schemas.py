"""
Pydantic 模型定义
与 packages/shared 中的 TypeScript 类型保持同步
"""

from typing import Literal, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


ParamSourceType = Literal["official", "local_doc", "assumption"]
RegionLevel = Literal["统筹区", "城市", "省级"]
PaymentMode = Literal["DRG", "DIP", "mixed"]
SettlementCycle = Literal["daily_demo", "monthly", "quarterly"]
EventType = Literal[
    "ARRIVAL", "ADMIT", "PROCEDURE", "DISCHARGE", "GROUPING", "SETTLE", "AUDIT"
]
SeverityLevel = Literal[1, 2, 3, 4]  # 1=轻, 2=中, 3=重, 4=危重
BatchPeriod = Literal["morning", "noon", "evening"]
SpecialCaseStrategy = Literal["uplift", "ffspay"]  # 特例单议策略


# ==================== RegionPack 相关 ====================


class EvidenceCard(BaseModel):
    """证据卡"""

    param_key: str
    source_type: ParamSourceType
    source_title: Optional[str] = None
    source_url: Optional[str] = None
    publish_date: Optional[str] = None
    excerpt: str
    notes: Optional[str] = None


class DRGConfig(BaseModel):
    """DRG 配置"""

    base_rate: float = Field(..., description="基础费率")
    adjustment_multiplier: float = Field(1.0, description="调节系数")
    outlier_multiplier: float = Field(3.0, description="极高费用阈值倍数")


class DIPPointValueModel(BaseModel):
    """DIP 点值模型"""

    multiplier: float = Field(1.0, description="本院点数权重")
    external_points_base: float = Field(..., description="区域外点数基数")


class DIPConfig(BaseModel):
    """DIP 配置"""

    point_value_model: DIPPointValueModel


class SpecialCaseConfig(BaseModel):
    """特例单议配置"""

    quota_rate_drg: float = Field(..., le=0.05, description="DRG 特例单议额度比例")
    quota_rate_dip: float = Field(..., le=0.005, description="DIP 特例单议额度比例")
    uplift_rate: float = Field(1.3, description="特例单议上浮比例")
    ffspay_rate: float = Field(0.85, description="按项目付费比例")


class BudgetModel(BaseModel):
    """预算模型"""

    annual_budget: Optional[float] = None
    description: Optional[str] = None


class RegionPack(BaseModel):
    """地区规则插件包"""

    id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    name: str
    region_level: RegionLevel
    payment_primary: PaymentMode
    policy_version: str
    settlement_cycle: SettlementCycle
    budget_model: Optional[BudgetModel] = None
    drg: DRGConfig
    dip: DIPConfig
    special_case: SpecialCaseConfig
    param_source_map: dict[str, ParamSourceType]
    evidence: list[EvidenceCard]


class RegionPackSummary(BaseModel):
    """地区包摘要（用于列表）"""

    id: str
    name: str
    region_level: RegionLevel
    payment_primary: PaymentMode
    policy_version: str
    source_stats: dict[str, int] = Field(
        default_factory=lambda: {"official": 0, "local_doc": 0, "assumption": 0}
    )


class ValidationError(BaseModel):
    """校验错误"""

    pack_id: str
    file_path: str
    errors: list[str]


# ==================== ScenarioPack 相关 ====================


ScenarioActionType = Literal["set_param", "toggle_strategy", "advance"]


class ScenarioAction(BaseModel):
    """场景动作"""

    type: ScenarioActionType
    payload: dict[str, Any] = Field(default_factory=dict)


class ScenarioExplainCheck(BaseModel):
    """解释题"""

    question: str
    options: list[str]
    correct_option_index: int
    rationale: str


class ScenarioPassCondition(BaseModel):
    """通过条件"""

    metric: str
    operator: Literal[">", ">=", "<", "<=", "=="]
    threshold: float
    window: Optional[str] = None
    suggest: Optional[str] = None


class ScenarioStep(BaseModel):
    """场景步骤"""

    step_id: str
    instruction: str
    action: ScenarioAction
    expected_observation: list[str] = Field(min_length=2)
    expected_rules: Optional[list[ScenarioPassCondition]] = None
    required_triggers: Optional[list[ScenarioPassCondition]] = None
    pass_condition: ScenarioPassCondition
    explain_check: ScenarioExplainCheck


class ScenarioCompletion(BaseModel):
    """场景完成要求"""

    export_required: bool = True
    artifacts: list[str]
    summary_template: str


class ScenarioPack(BaseModel):
    """情景推演包"""

    id: str
    title: str
    timebox_minutes: int
    learning_objective: str
    region_id: str
    seed: int
    initial_params: dict[str, Any] = Field(default_factory=dict)
    policy_version_tag: str
    steps: list[ScenarioStep]
    completion: ScenarioCompletion


class ScenarioPackSummary(BaseModel):
    """情景包摘要"""

    id: str
    title: str
    timebox_minutes: int
    learning_objective: str
    region_id: str
    policy_version_tag: str


# ==================== Event 事件账本 ====================


class EventDelta(BaseModel):
    """事件造成的状态增量"""

    inpatients: int = 0  # 在院人数变化
    total_cost: float = 0  # 总费用变化
    total_points: float = 0  # 总点数变化
    total_weight: float = 0  # 总权重变化
    pay_drg: float = 0  # DRG 支付变化
    pay_dip: float = 0  # DIP 支付变化
    margin_drg: float = 0  # DRG 利润变化
    margin_dip: float = 0  # DIP 利润变化
    cases_count: int = 0  # 病例数变化
    special_cases_count: int = 0  # 特例单议病例数变化


class Decomposition(BaseModel):
    """支付归因分解"""

    structural: float  # 结构因素（标准支付能力，如权重/点数 * 基础费率）
    price: float  # 价格因素（费率波动，如 DIP 点值贬值）
    management: float  # 管理因素（特例单议、极高费用谈判等）


class Explanation(BaseModel):
    """事件解释"""

    delta_total_pay_drg: float  # DRG 支付总额
    decomp_drg: Decomposition
    delta_total_pay_dip: float  # DIP 支付总额
    decomp_dip: Decomposition


class Event(BaseModel):
    """事件"""

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ts: str  # 模拟时间戳，格式: "Day1-morning-001"
    type: EventType
    case_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    delta: EventDelta = Field(default_factory=EventDelta)
    explanation: Optional[Explanation] = None  # 归因解释
    description: str = ""


# ==================== Case 病例 ====================


class Case(BaseModel):
    """病例"""

    case_id: str = Field(default_factory=lambda: f"CASE-{uuid.uuid4().hex[:8].upper()}")
    dept: str = "Ortho"  # V1 固定骨科
    severity_level: SeverityLevel = 2
    group_id: str = ""  # DRG/DIP 分组 ID
    drg_weight: float = 1.0
    dip_points: float = 100.0
    cost: float = 0  # 总费用
    los: int = 0  # 住院天数
    special_case_candidate: bool = False
    special_case_cost: float = 0  # 特例单议实际费用（用于 ffspay 策略）
    status: Literal["arrived", "admitted", "discharged", "settled"] = "arrived"
    arrival_day: int = 1
    discharge_day: Optional[int] = None


# ==================== Scenario 场景状态 ====================


class ScenarioParams(BaseModel):
    """场景参数"""

    region_id: str
    seed: int = 42
    total_days: int = 7  # V1 固定 7 天
    cases_per_day: int = 10  # 每天平均病例数
    budget: float = 1000000  # 本次仿真预算

    # 特例单议参数
    special_strategy: SpecialCaseStrategy = (
        "uplift"  # 策略: uplift(上浮) / ffspay(按项目付费)
    )
    special_uplift: Optional[float] = None  # 自定义上浮比例，None 时使用地区包默认值
    ffspay_rate: Optional[float] = None  # 自定义按项目付费比例，None 时使用地区包默认值
    special_aggressiveness: float = (
        0.5  # 激进程度 0.0(保守)-1.0(激进)，影响特例单议候选命中率
    )
    special_case_candidate_rate: Optional[float] = None  # 特例单议候选强制比例


class ScenarioState(BaseModel):
    """场景状态"""

    scenario_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    params: ScenarioParams
    current_day: int = 1
    current_batch: BatchPeriod = "morning"

    # 累计统计
    total_inpatients: int = 0
    total_cases: int = 0
    total_cost: float = 0
    total_weight: float = 0
    total_points: float = 0
    pay_drg_total: float = 0
    pay_dip_total: float = 0
    margin_drg_total: float = 0  # DRG 累计利润
    margin_dip_total: float = 0  # DIP 累计利润
    special_cases_drg: int = 0
    special_cases_dip: int = 0

    # DIP 点值信息
    current_point_value: float = 0  # 当前点值
    region_total_points: float = 0  # 区域总点数
    external_points: float = 0  # 区域外点数
    multiplier: float = 1.0  # 本院点数乘数

    # 特例单议额度管理
    quota_used_drg: int = 0  # DRG 已用额度（病例数）
    quota_max_drg: int = 0  # DRG 最大额度（病例数），运行时计算
    quota_used_dip: int = 0  # DIP 已用额度（病例数）
    quota_max_dip: int = 0  # DIP 最大额度（病例数），运行时计算

    # 管理效应追踪
    management_effect_drg: float = 0  # DRG 特例单议带来的额外收益
    management_effect_dip: float = 0  # DIP 特例单议带来的额外收益
    rejected_special_cases: int = 0  # 因额度限制被拒绝的特例单议申请数

    # 状态
    is_finished: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ScenarioSummary(BaseModel):
    """场景摘要"""

    scenario_id: str
    region_id: str
    seed: int
    current_day: int
    current_batch: BatchPeriod
    total_cases: int
    total_events: int
    is_finished: bool


# ==================== API 请求/响应 ====================


class StartScenarioRequest(BaseModel):
    """启动场景请求"""

    region_id: str
    seed: int = 42
    cases_per_day: int = 10
    budget: float = 1000000

    # 特例单议参数
    special_strategy: SpecialCaseStrategy = "uplift"
    special_uplift: Optional[float] = None
    ffspay_rate: Optional[float] = None
    special_aggressiveness: float = 0.5
    special_case_candidate_rate: Optional[float] = None


class StartScenarioResponse(BaseModel):
    """启动场景响应"""

    scenario_id: str
    state: ScenarioState
    message: str = "场景已创建"


class StepScenarioResponse(BaseModel):
    """推进场景响应"""

    scenario_id: str
    state: ScenarioState
    new_events: list[Event]
    message: str = ""


class ScenarioParamUpdate(BaseModel):
    """场景参数更新请求"""

    budget: Optional[float] = None
    external_points: Optional[float] = None
    special_strategy: Optional[SpecialCaseStrategy] = None
    special_aggressiveness: Optional[float] = None
    special_case_candidate_rate: Optional[float] = None


class ExportScenarioResponse(BaseModel):
    """导出场景响应"""

    scenario_id: str
    scenario_json: dict
    events_count: int
