/**
 * MedPay Sandbox - Shared Types
 * 
 * 核心类型定义
 */

// 事件类型
export type EventType = 
  | 'ARRIVAL' 
  | 'ADMIT' 
  | 'PROCEDURE' 
  | 'DISCHARGE' 
  | 'GROUPING' 
  | 'SETTLE' 
  | 'AUDIT'

// 导出 RegionPack 相关类型
export * from './regionpack'
export * from './scenariopack'
export * from './types'
