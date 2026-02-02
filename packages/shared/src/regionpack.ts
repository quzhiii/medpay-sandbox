/**
 * RegionPack 类型定义
 * 与 regionpack.schema.json 保持同步
 */

export type ParamSourceType = 'official' | 'local_doc' | 'assumption'
export type RegionLevel = '统筹区' | '城市' | '省级'
export type PaymentMode = 'DRG' | 'DIP' | 'mixed'
export type SettlementCycle = 'daily_demo' | 'monthly' | 'quarterly'

export interface EvidenceCard {
  param_key: string
  source_type: ParamSourceType
  source_title?: string
  source_url?: string | null
  publish_date?: string | null
  excerpt: string
  notes?: string | null
}

export interface DRGConfig {
  base_rate: number
  adjustment_multiplier: number
  outlier_multiplier: number
}

export interface DIPPointValueModel {
  multiplier: number
  external_points_base: number
}

export interface DIPConfig {
  point_value_model: DIPPointValueModel
}

export interface SpecialCaseConfig {
  quota_rate_drg: number
  quota_rate_dip: number
  uplift_rate: number
  ffspay_rate: number
}

export interface BudgetModel {
  annual_budget?: number
  description?: string
}

export interface RegionPack {
  id: string
  name: string
  region_level: RegionLevel
  payment_primary: PaymentMode
  policy_version: string
  settlement_cycle: SettlementCycle
  budget_model?: BudgetModel
  drg: DRGConfig
  dip: DIPConfig
  special_case: SpecialCaseConfig
  param_source_map: Record<string, ParamSourceType>
  evidence: EvidenceCard[]
}

// 地区包列表项（用于列表展示）
export interface RegionPackSummary {
  id: string
  name: string
  region_level: RegionLevel
  payment_primary: PaymentMode
  policy_version: string
  source_stats: {
    official: number
    local_doc: number
    assumption: number
  }
}
