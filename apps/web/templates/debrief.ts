import type { ScenarioPack, ScenarioState, Event } from '@/lib/api'

type DebriefContext = {
  pack: ScenarioPack
  state: ScenarioState
  events: Event[]
  exportUrl: string
  answers?: Array<{ stepId: string; selected: number; correct: boolean; rationale: string }>
}

const formatCurrency = (value: number) => `¥${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

const toPercent = (value: number) => `${(value * 100).toFixed(2)}%`

const getLastSettleEvent = (events: Event[]) =>
  [...events].reverse().find((event) => event.type === 'SETTLE')

const summarizeKeyChanges = (pack: ScenarioPack) => {
  const changes: string[] = []
  pack.steps.forEach((step) => {
    if (step.action.type === 'set_param' || step.action.type === 'toggle_strategy') {
      Object.entries(step.action.payload || {}).forEach(([key, value]) => {
        changes.push(`${key} = ${String(value)}`)
      })
    }
  })
  return Array.from(new Set(changes))
}

const summarizeObservations = (pack: ScenarioPack) => {
  const observations: string[] = []
  pack.steps.forEach((step) => {
    step.expected_observation.forEach((obs) => observations.push(obs))
  })
  return Array.from(new Set(observations))
}

const formatAnswerLine = (pack: ScenarioPack, item: { stepId: string; selected: number; correct: boolean; rationale: string }) => {
  const step = pack.steps.find((s) => s.step_id === item.stepId)
  const optionText = step?.explain_check?.options?.[item.selected]
  const optionLetter = String.fromCharCode(65 + item.selected)
  const answerLabel = optionText ? `${optionLetter}. ${optionText}` : optionLetter
  return `- ${item.stepId}：作答 ${answerLabel}（${item.correct ? '正确' : '错误'}）\n  - 解析：${item.rationale}`
}

const buildOneLineExplanation = (event: Event | undefined) => {
  if (!event?.explanation) {
    return '暂无解释器分解数据。'
  }
  const drg = event.explanation.decomp_drg
  const dip = event.explanation.decomp_dip
  const drgMax = Math.max(Math.abs(drg.structural), Math.abs(drg.price), Math.abs(drg.management))
  const dipMax = Math.max(Math.abs(dip.structural), Math.abs(dip.price), Math.abs(dip.management))
  const drgDriver =
    drgMax === Math.abs(drg.structural)
      ? '结构'
      : drgMax === Math.abs(drg.price)
        ? '价格'
        : '管理'
  const dipDriver =
    dipMax === Math.abs(dip.structural)
      ? '结构'
      : dipMax === Math.abs(dip.price)
        ? '价格'
        : '管理'
  return `DRG 主要由${drgDriver}效应驱动，DIP 主要由${dipDriver}效应驱动。`
}

export const buildDebriefMarkdown = ({ pack, state, events, exportUrl, answers = [] }: DebriefContext) => {
  const lastSettle = getLastSettleEvent(events)
  const payload = lastSettle?.payload || {}
  const explanation = lastSettle?.explanation

  const drgPay = lastSettle?.delta?.pay_drg ?? 0
  const dipPay = lastSettle?.delta?.pay_dip ?? 0
  const cost = Number(payload.cost ?? 0)
  const marginDrg = lastSettle?.delta?.margin_drg ?? 0
  const marginDip = lastSettle?.delta?.margin_dip ?? 0
  const marginRateDrg = cost > 0 ? marginDrg / cost : 0
  const marginRateDip = cost > 0 ? marginDip / cost : 0

  const keyChanges = summarizeKeyChanges(pack)
  const observations = summarizeObservations(pack)
  const topEvents = [...events].slice(-3).reverse()

  return `# 情景复盘卡

## 场景信息
- 场景标题：${pack.title}
- 学习目标：${pack.learning_objective}
- region_id：${pack.region_id}
- policy_version_tag：${pack.policy_version_tag}
- seed：${pack.seed}

## 关键参数变更
${keyChanges.length ? keyChanges.map((item) => `- ${item}`).join('\n') : '- 无'}

## 关键观察点
${observations.map((item) => `- ${item}`).join('\n')}

## 最后一轮结算摘要
- DRG 支付：${formatCurrency(drgPay)} | 利润：${formatCurrency(marginDrg)} | 利润率：${toPercent(marginRateDrg)}
- DIP 支付：${formatCurrency(dipPay)} | 利润：${formatCurrency(marginDip)} | 利润率：${toPercent(marginRateDip)}
- 成本：${formatCurrency(cost)}

## DIP 点值分母拆解
- 预算：${formatCurrency(state.params.budget)}
- 区域总点数：${state.region_total_points.toLocaleString()}
- 本院乘数：${state.multiplier.toFixed(2)}
- 区域外点数：${state.external_points.toLocaleString()}

## 特例单议额度
- DRG quota：${state.quota_used_drg}/${state.quota_max_drg}
- DIP quota：${state.quota_used_dip}/${state.quota_max_dip}

## 解释器三分解
- DRG（结构/价格/管理）：${explanation ? `${drgPay.toFixed(2)} = ${explanation.decomp_drg.structural.toFixed(2)} / ${explanation.decomp_drg.price.toFixed(2)} / ${explanation.decomp_drg.management.toFixed(2)}` : '暂无'}
- DIP（结构/价格/管理）：${explanation ? `${dipPay.toFixed(2)} = ${explanation.decomp_dip.structural.toFixed(2)} / ${explanation.decomp_dip.price.toFixed(2)} / ${explanation.decomp_dip.management.toFixed(2)}` : '暂无'}
- 一句话解释：${buildOneLineExplanation(lastSettle)}

## Top 3 关键事件
${topEvents.length ? topEvents.map((event) => `- ${event.event_id}：${event.description}`).join('\n') : '- 暂无'}

## 导出文件链接
- scenario.json / events.jsonl / results.csv：${exportUrl}

## 答题记录
${answers.length ? answers.map((item) => formatAnswerLine(pack, item)).join('\n') : '- 无'}
`
}
