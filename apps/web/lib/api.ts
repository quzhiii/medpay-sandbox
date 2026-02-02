/**
 * API 客户端
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ==================== Region Types ====================

export interface RegionPackSummary {
  id: string
  name: string
  region_level: '统筹区' | '城市' | '省级'
  payment_primary: 'DRG' | 'DIP' | 'mixed'
  policy_version: string
  source_stats: {
    official: number
    local_doc: number
    assumption: number
  }
}

export interface EvidenceCard {
  param_key: string
  source_type: 'official' | 'local_doc' | 'assumption'
  source_title?: string
  source_url?: string | null
  publish_date?: string | null
  excerpt: string
  notes?: string | null
}

export interface RegionPack {
  id: string
  name: string
  region_level: '统筹区' | '城市' | '省级'
  payment_primary: 'DRG' | 'DIP' | 'mixed'
  policy_version: string
  settlement_cycle: 'daily_demo' | 'monthly' | 'quarterly'
  drg: {
    base_rate: number
    adjustment_multiplier: number
    outlier_multiplier: number
  }
  dip: {
    point_value_model: {
      multiplier: number
      external_points_base: number
    }
  }
  special_case: {
    quota_rate_drg: number
    quota_rate_dip: number
    uplift_rate: number
    ffspay_rate: number
  }
  param_source_map: Record<string, 'official' | 'local_doc' | 'assumption'>
  evidence: EvidenceCard[]
}

// ==================== Scenario Types ====================

export type EventType = 'ARRIVAL' | 'ADMIT' | 'PROCEDURE' | 'DISCHARGE' | 'GROUPING' | 'SETTLE' | 'AUDIT'
export type BatchPeriod = 'morning' | 'noon' | 'evening'

export interface EventDelta {
  inpatients: number
  total_cost: number
  total_points: number
  total_weight: number
  pay_drg: number
  pay_dip: number
  margin_drg: number
  margin_dip: number
  cases_count: number
  special_cases_count: number
}

export interface Decomposition {
  structural: number
  price: number
  management: number
}

export interface Explanation {
  delta_total_pay_drg: number
  decomp_drg: Decomposition
  delta_total_pay_dip: number
  decomp_dip: Decomposition
}

export interface Event {
  event_id: string
  ts: string
  type: EventType
  case_id?: string | null
  payload: Record<string, unknown>
  delta: EventDelta
  explanation?: Explanation
  description: string
}

export interface ScenarioParams {
  region_id: string
  seed: number
  total_days: number
  cases_per_day: number
  budget: number
  special_strategy: 'uplift' | 'ffspay'
  special_uplift?: number
  ffspay_rate?: number
  special_aggressiveness: number
}

export interface ScenarioState {
  scenario_id: string
  params: ScenarioParams
  current_day: number
  current_batch: BatchPeriod
  total_inpatients: number
  total_cases: number
  total_cost: number
  total_weight: number
  total_points: number
  pay_drg_total: number
  pay_dip_total: number
  margin_drg_total: number
  margin_dip_total: number
  special_cases_drg: number
  special_cases_dip: number
  
  // DIP 点值信息
  current_point_value: number
  region_total_points: number
  external_points: number
  multiplier: number

  // 特例单议额度管理
  quota_used_drg: number
  quota_max_drg: number
  quota_used_dip: number
  quota_max_dip: number

  // 管理效应追踪
  management_effect_drg: number
  management_effect_dip: number
  rejected_special_cases: number

  is_finished: boolean
  created_at: string
}

export interface ScenarioSummary {
  scenario_id: string
  region_id: string
  seed: number
  current_day: number
  current_batch: BatchPeriod
  total_cases: number
  total_events: number
  is_finished: boolean
}

export interface StartScenarioRequest {
  region_id: string
  seed?: number
  cases_per_day?: number
  budget?: number
  special_strategy?: 'uplift' | 'ffspay'
  special_uplift?: number
  ffspay_rate?: number
  special_aggressiveness?: number
}

export interface StartScenarioResponse {
  scenario_id: string
  state: ScenarioState
  message: string
}

export interface ScenarioPackSummary {
  id: string
  title: string
  timebox_minutes: number
  learning_objective: string
  region_id: string
  policy_version_tag: string
}

export interface ScenarioAction {
  type: 'set_param' | 'toggle_strategy' | 'advance'
  payload: Record<string, unknown>
}

export interface ScenarioExplainCheck {
  question: string
  options: string[]
  correct_option_index: number
  rationale: string
}

export interface ScenarioPassCondition {
  metric: string
  operator: '>' | '>=' | '<' | '<=' | '=='
  threshold: number
  window?: string
  suggest?: string
}

export interface ScenarioStep {
  step_id: string
  instruction: string
  action: ScenarioAction
  expected_observation: string[]
  expected_rules?: ScenarioPassCondition[]
  required_triggers?: ScenarioPassCondition[]
  pass_condition: ScenarioPassCondition
  explain_check: ScenarioExplainCheck
}

export interface ScenarioCompletion {
  export_required: true
  artifacts: string[]
  summary_template: string
}

export interface ScenarioPack {
  id: string
  title: string
  timebox_minutes: number
  learning_objective: string
  region_id: string
  seed: number
  initial_params: Record<string, unknown>
  policy_version_tag: string
  steps: ScenarioStep[]
  completion: ScenarioCompletion
}

export interface ScenarioParamUpdate {
  budget?: number
  external_points?: number
  special_strategy?: 'uplift' | 'ffspay'
  special_aggressiveness?: number
  special_case_candidate_rate?: number
}

export interface ScenarioMetricsResponse {
  window: 'instant' | 'last_settle' | 'day'
  metrics: Record<string, number | null>
  null_reasons: Record<string, string>
  catalog: Record<string, { key: string; label_zh: string; unit: string; description: string; window_supported: string[]; compute_source: string; null_reason: string }>
}

export interface StepScenarioResponse {
  scenario_id: string
  state: ScenarioState
  new_events: Event[]
  message: string
}

// ==================== API Client ====================

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(error.detail || `API Error: ${res.status}`)
    }

    return res.json()
  }

  // 地区包相关
  async getRegions(): Promise<RegionPackSummary[]> {
    return this.fetch('/regions')
  }

  async getRegion(id: string): Promise<RegionPack> {
    return this.fetch(`/regions/${id}`)
  }

  async reloadRegions(): Promise<{ success_count: number; error_count: number }> {
    return this.fetch('/regions/reload', { method: 'POST' })
  }

  // 场景相关
  async startScenario(request: StartScenarioRequest): Promise<StartScenarioResponse> {
    return this.fetch('/scenario/start', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async stepScenario(scenarioId: string): Promise<StepScenarioResponse> {
    return this.fetch(`/scenario/${scenarioId}/step`, {
      method: 'POST',
    })
  }

  async getScenario(scenarioId: string): Promise<ScenarioSummary> {
    return this.fetch(`/scenario/${scenarioId}`)
  }

  async getScenarioEvents(scenarioId: string, limit = 100, offset = 0): Promise<Event[]> {
    return this.fetch(`/scenario/${scenarioId}/events?limit=${limit}&offset=${offset}`)
  }

  async listScenarios(): Promise<ScenarioPackSummary[]> {
    return this.fetch('/scenarios')
  }

  async listScenarioPacks(): Promise<ScenarioPackSummary[]> {
    return this.fetch('/scenarios')
  }

  async getScenarioPack(id: string): Promise<ScenarioPack> {
    return this.fetch(`/scenarios/${id}`)
  }

  async updateScenarioParams(scenarioId: string, request: ScenarioParamUpdate): Promise<{ message: string; state: ScenarioState }> {
    return this.fetch(`/scenario/${scenarioId}/params`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getScenarioMetrics(scenarioId: string, window: 'instant' | 'last_settle' | 'day'): Promise<ScenarioMetricsResponse> {
    return this.fetch(`/scenario/${scenarioId}/metrics?window=${window}`)
  }

  getScenarioExportUrl(scenarioId: string): string {
    return `${this.baseUrl}/scenario/${scenarioId}/export`
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    return this.fetch(`/scenario/${scenarioId}`, { method: 'DELETE' })
  }

  // 健康检查
  async health(): Promise<{ status: string; packs_loaded: number; active_scenarios: number }> {
    return this.fetch('/health')
  }
}

export const api = new ApiClient()
