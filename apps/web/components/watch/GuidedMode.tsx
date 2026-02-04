'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  BookOpen, 
  AlertCircle,
  RotateCcw,
  Check,
  ChevronRight,
  FileText
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  api, 
  ScenarioPack, 
  ScenarioStep, 
  ScenarioState, 
  Event, 
  ScenarioPassCondition,
  ScenarioPackSummary,
  ScenarioMetricsResponse
} from '@/lib/api'
import { buildDebriefMarkdown } from '@/templates/debrief'

interface GuidedModeProps {
  scenarioState: ScenarioState | null
  events: Event[]
  onScenarioChange: (state: ScenarioState | null, events: Event[]) => void
}

export function GuidedMode({ scenarioState, events, onScenarioChange }: GuidedModeProps) {
  // Local state
  const [packs, setPacks] = useState<ScenarioPackSummary[]>([])
  const [selectedPackId, setSelectedPackId] = useState<string>('')
  const [currentPack, setCurrentPack] = useState<ScenarioPack | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [baselineState, setBaselineState] = useState<ScenarioState | null>(null)
  
  // Step execution state
  const [stepStatus, setStepStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [failReason, setFailReason] = useState<string | null>(null)
  const [failSuggest, setFailSuggest] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  
  // Quiz state
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [checkResult, setCheckResult] = useState<'correct' | 'incorrect' | null>(null)
  const [debriefMarkdown, setDebriefMarkdown] = useState<string>('')
  const [debriefReady, setDebriefReady] = useState(false)
  const [checklistStatus, setChecklistStatus] = useState<Record<number, { passed: boolean; value?: number | null; reason?: string }>>({})
  const [passDetail, setPassDetail] = useState<{ value: number | null; condition: ScenarioPassCondition } | null>(null)
  const [answerLog, setAnswerLog] = useState<Array<{ stepId: string; selected: number; correct: boolean; rationale: string }>>([])

  // Derived
  const currentStep = currentPack?.steps[activeStepIndex]
  const isLastStep = currentPack && activeStepIndex === currentPack.steps.length - 1
  const latestExplanation = useMemo(() => 
    events.slice().reverse().find(e => e.explanation)?.explanation, 
  [events])

  // Initial load
  useEffect(() => {
    api.listScenarioPacks().then(setPacks).catch(console.error)
  }, [])

  // Load full pack details when selected
  useEffect(() => {
    if (!selectedPackId) return
    api.getScenarioPack(selectedPackId).then(pack => {
      setCurrentPack(pack)
      setActiveStepIndex(0)
      setStepStatus('idle')
      setBaselineState(null)
      setSelectedOption(null)
      setCheckResult(null)
      setAnswerLog([])
    }).catch(console.error)
  }, [selectedPackId])

  const evaluatePassCondition = (
    condition: ScenarioPassCondition,
    metrics: ScenarioMetricsResponse
  ): { passed: boolean; value: number | null; reason: string } => {
    const value = metrics.metrics[condition.metric]
    if (value === null || value === undefined) {
      return {
        passed: false,
        value: null,
        reason: metrics.null_reasons[condition.metric] || '指标不可用'
      }
    }

    const threshold = condition.threshold
    let passed = false
    switch (condition.operator) {
      case '>': passed = value > threshold; break;
      case '>=': passed = value >= threshold; break;
      case '<': passed = value < threshold; break;
      case '<=': passed = value <= threshold; break;
      case '==': passed = Math.abs(value - threshold) < 1e-6; break;
    }

    return {
      passed,
      value,
      reason: `${condition.metric}: ${value.toFixed(4)} ${condition.operator} ${threshold}`
    }
  }

  const getStepWindows = (step: ScenarioStep) => {
    const windows = new Set<string>()
    windows.add(step.pass_condition.window || 'last_settle')
    ;(step.expected_rules || []).forEach((rule) => windows.add(rule.window || 'last_settle'))
    ;(step.required_triggers || []).forEach((trigger) => windows.add(trigger.window || 'last_settle'))
    return windows
  }

  const formatConditionLabel = (condition: ScenarioPassCondition) => {
    const window = condition.window || 'last_settle'
    return `${condition.metric} ${condition.operator} ${condition.threshold} · ${window}`
  }

  const getRequiredTriggerFailure = (
    step: ScenarioStep,
    metricsByWindow: Record<string, ScenarioMetricsResponse>
  ) => {
    const requiredTriggers = step.required_triggers || []
    for (const trigger of requiredTriggers) {
      const triggerMetrics = metricsByWindow[trigger.window || 'last_settle']
      const res = evaluatePassCondition(trigger, triggerMetrics)
      if (!res.passed) {
        return { reason: res.reason, suggest: trigger.suggest || null }
      }
    }
    return null
  }

  const fetchMetricsByWindow = async (scenarioId: string, step: ScenarioStep) => {
    const windows = getStepWindows(step)
    const metricsByWindowEntries = await Promise.all(
      Array.from(windows).map(async (win) => [win, await api.getScenarioMetrics(scenarioId, win as any)] as const)
    )
    return Object.fromEntries(metricsByWindowEntries) as Record<string, ScenarioMetricsResponse>
  }

  const evaluateStep = async (step: ScenarioStep, scenarioId: string) => {
    const metricsByWindow = await fetchMetricsByWindow(scenarioId, step)
    const passMetrics = metricsByWindow[step.pass_condition.window || 'last_settle']
    const evalResult = evaluatePassCondition(step.pass_condition, passMetrics)
    const requiredFailure = getRequiredTriggerFailure(step, metricsByWindow)
    const rules = step.expected_rules || []
    const checklist = rules.reduce((acc, rule, idx) => {
      const ruleMetrics = metricsByWindow[rule.window || 'last_settle']
      const res = evaluatePassCondition(rule, ruleMetrics)
      acc[idx] = { passed: res.passed, value: res.value, reason: res.reason }
      return acc
    }, {} as Record<number, { passed: boolean; value?: number | null; reason?: string }>)

    setChecklistStatus(checklist)
    setPassDetail({ value: evalResult.value, condition: step.pass_condition })

    if (evalResult.passed && !requiredFailure) {
      setStepStatus('success')
      setFailReason(null)
      setFailSuggest(null)
    } else {
      setStepStatus('failed')
      const failureReason = requiredFailure ? requiredFailure.reason : evalResult.reason
      const failureSuggest = requiredFailure
        ? (requiredFailure.suggest || step.pass_condition.suggest || null)
        : (step.pass_condition.suggest || null)
      setFailReason(failureReason)
      setFailSuggest(failureSuggest)
    }
  }

  // Handlers
  const handleStartScenario = async (): Promise<ScenarioState | null> => {
    if (!currentPack) return null
    setExecuting(true)
    try {
      const allowedStartKeys = [
        'seed',
        'cases_per_day',
        'budget',
        'special_strategy',
        'special_uplift',
        'ffspay_rate',
        'special_aggressiveness',
        'special_case_candidate_rate'
      ]
      const filteredParams = Object.fromEntries(
        Object.entries(currentPack.initial_params || {}).filter(([key]) => allowedStartKeys.includes(key))
      )
      // Start fresh
      const res = await api.startScenario({
        region_id: currentPack.region_id,
        seed: currentPack.seed,
        ...filteredParams
      })
      onScenarioChange(res.state, [])
      setBaselineState(res.state)
      setStepStatus('idle')
      setFailReason(null)
      setSelectedOption(null)
      setCheckResult(null)
      return res.state
    } catch (e) {
      console.error(e)
      return null
    } finally {
      setExecuting(false)
    }
  }

  const handleExecuteStep = async () => {
    if (!currentStep) return
    setExecuting(true)
    
    let workingState = scenarioState
    if (!workingState) {
      workingState = await handleStartScenario()
    }

    if (!workingState) {
      setExecuting(false)
      return
    }

    const base = baselineState || workingState

    try {
      const action = currentStep.action
      let newState = workingState
      let newEvents = []

      const runBatches = async (
        batches: number,
        loopUntil: boolean,
        maxBatches: number
      ) => {
        const limit = loopUntil && maxBatches > 0 ? maxBatches : batches
        for (let i = 0; i < limit; i++) {
          const res = await api.stepScenario(workingState.scenario_id)
          newState = res.state
          newEvents.push(...res.new_events)
          if (loopUntil && maxBatches > 0) {
            const metricsByWindow = await fetchMetricsByWindow(workingState.scenario_id, currentStep)
            const passMetrics = metricsByWindow[currentStep.pass_condition.window || 'last_settle']
            const evalResult = evaluatePassCondition(currentStep.pass_condition, passMetrics)
            const requiredFailure = getRequiredTriggerFailure(currentStep, metricsByWindow)
            if (evalResult.passed && !requiredFailure) {
              break
            }
          }
        }
      }

      // Execute Action
      if (action.type === 'set_param' || action.type === 'toggle_strategy') {
        const payload = action.payload as any
        const allowedUpdateKeys = [
          'budget',
          'external_points',
          'special_strategy',
          'special_aggressiveness',
          'special_case_candidate_rate'
        ]
        const filteredPayload = Object.fromEntries(
          Object.entries(payload || {}).filter(([key]) => allowedUpdateKeys.includes(key))
        )
        const res = await api.updateScenarioParams(workingState.scenario_id, filteredPayload)
        newState = res.state
        const advanceBatches = Number(payload?.n_batches ?? payload?.advance_batches ?? 0)
        const loopUntil = Boolean(payload?.loop_until)
        const maxBatches = Number(payload?.max_batches ?? 0)
        if (advanceBatches > 0) {
          await runBatches(advanceBatches, loopUntil, maxBatches)
        }
        // No new events from param update usually, or maybe? API says param update returns state.
      } else if (action.type === 'advance') {
        const payload = action.payload as any
        const batches = Number(payload?.n_batches ?? payload?.batches ?? 1)
        const loopUntil = Boolean(payload?.loop_until)
        const maxBatches = Number(payload?.max_batches ?? 0)
        
        // Loop for batches
        await runBatches(batches, loopUntil, maxBatches)
      }

      // Update parent
      onScenarioChange(newState, [...events, ...newEvents])

      await evaluateStep(currentStep, workingState.scenario_id)

    } catch (e) {
      console.error(e)
      setFailReason(e instanceof Error ? e.message : 'Execution failed')
      setFailSuggest(null)
      setStepStatus('failed')
    } finally {
      setExecuting(false)
    }
  }

  const handleCheckExplain = () => {
    if (!currentStep || selectedOption === null) return
    const isCorrect = selectedOption === currentStep.explain_check.correct_option_index
    setCheckResult(isCorrect ? 'correct' : 'incorrect')
    setAnswerLog((prev) => [
      ...prev,
      {
        stepId: currentStep.step_id,
        selected: selectedOption,
        correct: isCorrect,
        rationale: currentStep.explain_check.rationale,
      },
    ])
  }

  const handleNextStep = () => {
    if (isLastStep) return
    setActiveStepIndex(prev => prev + 1)
    setStepStatus('idle')
    setBaselineState(scenarioState) // Capture state before next step starts
    setSelectedOption(null)
    setCheckResult(null)
    setDebriefReady(false)
    setDebriefMarkdown('')
    setChecklistStatus({})
    setFailSuggest(null)
  }

  const handleGenerateDebrief = () => {
    if (!currentPack || !scenarioState) return
    const exportUrl = api.getScenarioExportUrl(scenarioState.scenario_id)
    const markdown = buildDebriefMarkdown({
      pack: currentPack,
      state: scenarioState,
      events,
      exportUrl,
      answers: answerLog,
    })
    setDebriefMarkdown(markdown)
    setDebriefReady(true)
  }

  const handleDownloadMarkdown = () => {
    if (!debriefMarkdown || !currentPack) return
    const blob = new Blob([debriefMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `debrief_${currentPack.id}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const isScenarioComplete =
    stepStatus === 'success' &&
    isLastStep &&
    (!currentStep?.explain_check || checkResult === 'correct')

  // UI Components
  if (!packs.length) {
    return <div className="p-4 text-muted-foreground">Loading packs...</div>
  }

  return (
    <div className="space-y-6">
      {/* Pack Selection */}
      <div className="flex items-center gap-4">
        <select 
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={selectedPackId}
          onChange={(e) => setSelectedPackId(e.target.value)}
        >
          <option value="" disabled>选择情景包...</option>
          {packs.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        
        {currentPack && (
          <Button onClick={handleStartScenario} disabled={executing} variant="default">
            <RotateCcw className="mr-2 h-4 w-4" />
            重置情景
          </Button>
        )}
      </div>

      {currentPack && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl text-primary">{currentPack.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{currentPack.learning_objective}</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                  Step {activeStepIndex + 1} / {currentPack.steps.length}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: `${((activeStepIndex + (stepStatus === 'success' ? 1 : 0)) / currentPack.steps.length) * 100}%` }}
              />
            </div>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-6">
            {/* Step Instruction */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                当前任务
              </h3>
              <div className="bg-muted/50 p-4 rounded-lg text-sm leading-relaxed border border-border/50">
                {currentStep?.instruction}
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">预期观察:</p>
                <ul className="space-y-2">
                  {currentStep?.expected_observation.map((obs, i) => {
                    const rule = currentStep?.expected_rules?.[i]
                    const status = checklistStatus[i]
                    return (
                      <li key={i} className="text-sm text-foreground/80">
                        <div className="flex items-start gap-2">
                          {status?.passed ? (
                            <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm">{obs}</div>
                            {rule && (
                              <div className="text-xs text-muted-foreground font-mono mt-1">
                                {formatConditionLabel(rule)}
                              </div>
                            )}
                          </div>
                          {rule && (
                            <div className={`text-xs ${status?.passed ? 'text-green-600' : 'text-muted-foreground'}`}>
                              <div>{status?.passed ? '已达成' : '待达成'}</div>
                              {typeof status?.value === 'number' && (
                                <div className="font-mono">{status.value.toFixed(4)}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* Action Area */}
            <div className="flex items-center justify-between border-t border-border pt-6">
              <div className="flex items-center gap-4">
                {stepStatus === 'idle' || stepStatus === 'failed' ? (
                  <Button 
                    size="lg" 
                    onClick={handleExecuteStep} 
                    disabled={executing}
                    className="min-w-[140px]"
                  >
                    {executing ? '执行中...' : '执行本步'}
                    {!executing && <Play className="ml-2 h-4 w-4" />}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 font-medium px-4 py-2 bg-green-50 rounded-md border border-green-200">
                    <CheckCircle2 className="h-5 w-5" />
                    本步执行并通过
                  </div>
                )}
                
                {stepStatus === 'failed' && (
                   <div className="flex items-center gap-2 text-red-600 text-sm px-3 py-1.5 bg-red-50 rounded-md border border-red-200">
                     <XCircle className="h-4 w-4" />
                     {failReason || '未满足通过条件'}
                   </div>
                )}
              </div>
              {stepStatus === 'failed' && currentStep && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {passDetail && (
                    <div>
                      当前值：{typeof passDetail.value === 'number' ? passDetail.value.toFixed(4) : '不可用'}
                      {' '}| 阈值：{passDetail.condition.threshold}
                      {' '}({passDetail.condition.metric} {passDetail.condition.operator} {passDetail.condition.window || 'last_settle'})
                    </div>
                  )}
                  <div>
                    建议：
                    {currentStep.hints?.length ? (
                      <ul className="ml-1 list-disc list-inside">
                        {currentStep.hints.map((hint, index) => (
                          <li key={`${currentStep.step_id}-hint-${index}`}>{hint}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="ml-1">{failSuggest || '可尝试“快速推进 x6 批”或根据步骤说明调整参数。'}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!scenarioState) return
                    setExecuting(true)
                    const batches = 6
                    let newState = scenarioState
                    const newEvents: Event[] = []
                    for (let i = 0; i < batches; i++) {
                      const res = await api.stepScenario(scenarioState.scenario_id)
                      newState = res.state
                      newEvents.push(...res.new_events)
                    }
                    onScenarioChange(newState, [...events, ...newEvents])
                    if (currentStep) {
                      await evaluateStep(currentStep, scenarioState.scenario_id)
                    }
                    setExecuting(false)
                  }}
                  disabled={!scenarioState || executing}
                >
                  快速推进 x6 批
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!scenarioState) return
                    setExecuting(true)
                    const batches = 12
                    let newState = scenarioState
                    const newEvents: Event[] = []
                    for (let i = 0; i < batches; i++) {
                      const res = await api.stepScenario(scenarioState.scenario_id)
                      newState = res.state
                      newEvents.push(...res.new_events)
                    }
                    onScenarioChange(newState, [...events, ...newEvents])
                    setExecuting(false)
                  }}
                  disabled={!scenarioState || executing}
                >
                  快速推进 x12 批
                </Button>
              </div>
            </div>

            {/* Check / Quiz Area */}
            {stepStatus === 'success' && currentStep?.explain_check && (
              <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <h4 className="font-semibold flex items-center gap-2 mb-4 text-blue-900 dark:text-blue-100">
                  <AlertCircle className="h-5 w-5" />
                  复盘提问
                </h4>
                <p className="mb-4 text-sm font-medium">{currentStep.explain_check.question}</p>
                
                <div className="grid gap-3 mb-4">
                  {currentStep.explain_check.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => !checkResult && setSelectedOption(idx)}
                      disabled={!!checkResult}
                      className={`text-left text-sm p-3 rounded-lg border transition-all ${
                        selectedOption === idx
                          ? checkResult
                            ? checkResult === 'correct'
                              ? 'bg-green-100 border-green-300 text-green-900'
                              : 'bg-red-100 border-red-300 text-red-900'
                            : 'bg-primary/10 border-primary text-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      <span className="mr-2 opacity-70">{String.fromCharCode(65 + idx)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>

                {!checkResult && selectedOption !== null && (
                  <Button onClick={handleCheckExplain} size="sm">
                    提交答案
                  </Button>
                )}

                {checkResult && (
                  <div className={`mt-4 text-sm p-3 rounded-md ${
                    checkResult === 'correct' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    <p className="font-bold mb-1">
                      {checkResult === 'correct' ? '回答正确' : '回答错误'}
                    </p>
                    <p>{currentStep.explain_check.rationale}</p>
                  </div>
                )}
              </div>
            )}

            {/* Next Step / Debrief */}
            {stepStatus === 'success' && (!currentStep?.explain_check || checkResult === 'correct') && (
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                {isLastStep ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-primary">情景已完成</p>
                        <p className="text-xs text-muted-foreground">生成复盘卡并导出结果包</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={handleGenerateDebrief} variant="default">
                          生成复盘卡
                        </Button>
                        <Button
                          onClick={() => scenarioState && window.open(api.getScenarioExportUrl(scenarioState.scenario_id), '_blank')}
                          variant="outline"
                          className="gap-2"
                          disabled={!scenarioState}
                        >
                          <FileText className="h-4 w-4" />
                          下载导出包
                        </Button>
                      </div>
                    </div>

                    {debriefReady && (
                      <div className="mt-4 rounded-md border bg-background p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">复盘卡预览（Markdown）</p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={handleDownloadMarkdown}>
                              下载 .md
                            </Button>
                            <Button size="sm" variant="ghost" disabled>
                              PDF（后置）
                            </Button>
                          </div>
                        </div>
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                          {debriefMarkdown.slice(0, 1200)}
                        </pre>
                        {debriefMarkdown.length > 1200 && (
                          <p className="mt-2 text-xs text-muted-foreground">仅显示前 1200 字，完整内容请下载。</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button onClick={handleNextStep} className="gap-2">
                      下一步 <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
