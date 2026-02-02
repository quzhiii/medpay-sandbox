'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Monitor, Loader2, LayoutGrid, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventStream } from '@/components/watch/EventStream'
import { EventDetail } from '@/components/watch/EventDetail'
import { ScenarioControls } from '@/components/watch/ScenarioControls'
import { ExplanationCard } from '@/components/watch/ExplanationCard'
import { GuidedMode } from '@/components/watch/GuidedMode'
import { 
  api, 
  Event, 
  ScenarioState, 
  RegionPackSummary 
} from '@/lib/api'

export default function WatchPage() {
  // 状态
  const [regions, setRegions] = useState<RegionPackSummary[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [seed, setSeed] = useState(42)
  const [specialStrategy, setSpecialStrategy] = useState<'uplift' | 'ffspay'>('uplift')
  const [specialAggressiveness, setSpecialAggressiveness] = useState(0.5)
  const [scenarioState, setScenarioState] = useState<ScenarioState | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAutoRunning, setIsAutoRunning] = useState(false)
  const [mode, setMode] = useState<'free' | 'guided'>('free')
  
  const autoRunRef = useRef<NodeJS.Timeout | null>(null)

  // 获取最新的解释
  const latestExplanation = events.slice().reverse().find(e => e.explanation)?.explanation

  // 加载地区包列表
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const data = await api.getRegions()
        setRegions(data)
        if (data.length > 0) {
          setSelectedRegion(data[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载地区包失败')
      } finally {
        setLoading(false)
      }
    }
    loadRegions()
  }, [])

  // 启动场景
  const handleStart = useCallback(async () => {
    if (!selectedRegion) return
    
    try {
      setError(null)
      const response = await api.startScenario({
        region_id: selectedRegion,
        seed,
        cases_per_day: 10,
        budget: 1000000,
        special_strategy: specialStrategy,
        special_aggressiveness: specialAggressiveness,
      })
      setScenarioState(response.state)
      setEvents([])
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动场景失败')
    }
  }, [selectedRegion, seed])

  // 推进场景
  const handleStep = useCallback(async () => {
    if (!scenarioState) return
    
    try {
      setError(null)
      const response = await api.stepScenario(scenarioState.scenario_id)
      setScenarioState(response.state)
      setEvents(prev => [...prev, ...response.new_events])
    } catch (e) {
      setError(e instanceof Error ? e.message : '推进场景失败')
      setIsAutoRunning(false)
    }
  }, [scenarioState])

  // 重置场景
  const handleReset = useCallback(async () => {
    if (autoRunRef.current) {
      clearInterval(autoRunRef.current)
      autoRunRef.current = null
    }
    setIsAutoRunning(false)
    
    if (scenarioState) {
      try {
        await api.deleteScenario(scenarioState.scenario_id)
      } catch {
        // ignore
      }
    }
    
    setScenarioState(null)
    setEvents([])
    setSelectedEvent(null)
    setError(null)
  }, [scenarioState])

  // 自动运行
  const handleAutoRun = useCallback(() => {
    if (isAutoRunning) {
      if (autoRunRef.current) {
        clearInterval(autoRunRef.current)
        autoRunRef.current = null
      }
      setIsAutoRunning(false)
    } else {
      setIsAutoRunning(true)
    }
  }, [isAutoRunning])

  // 自动运行效果
  useEffect(() => {
    if (isAutoRunning && scenarioState && !scenarioState.is_finished) {
      autoRunRef.current = setInterval(() => {
        handleStep()
      }, 500)
    }
    
    return () => {
      if (autoRunRef.current) {
        clearInterval(autoRunRef.current)
      }
    }
  }, [isAutoRunning, scenarioState, handleStep])

  // 场景完成时停止自动运行
  useEffect(() => {
    if (scenarioState?.is_finished) {
      setIsAutoRunning(false)
    }
  }, [scenarioState?.is_finished])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-screen-2xl py-8">
      {/* Page Header & Mode Toggle */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">监视屏幕</h1>
            <p className="text-sm text-muted-foreground">
              实时观察 DRG/DIP 双引擎仿真过程
            </p>
          </div>
        </div>

        <div className="flex items-center rounded-lg border bg-card p-1 text-sm shadow-sm">
          <button
            onClick={() => setMode('free')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === 'free' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            自由模式
          </button>
          <button
            onClick={() => setMode('guided')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === 'guided' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            情景模式
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Control Bar */}
      <div className="mb-6">
        {mode === 'free' ? (
          <ScenarioControls
            state={scenarioState}
            regions={regions}
            selectedRegion={selectedRegion}
            seed={seed}
            isRunning={isAutoRunning}
            specialStrategy={specialStrategy}
            specialAggressiveness={specialAggressiveness}
            onRegionChange={setSelectedRegion}
            onSeedChange={setSeed}
            onSpecialStrategyChange={setSpecialStrategy}
            onSpecialAggressivenessChange={setSpecialAggressiveness}
            onStart={handleStart}
            onStep={handleStep}
            onReset={handleReset}
            onAutoRun={handleAutoRun}
          />
        ) : (
          <GuidedMode 
            scenarioState={scenarioState}
            events={events}
            onScenarioChange={(s, e) => {
              setScenarioState(s)
              setEvents(e)
              if (s === null) {
                setIsAutoRunning(false)
              }
            }}
          />
        )}
      </div>

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Event Stream */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>事件流</span>
              <span className="text-sm font-normal text-muted-foreground">
                {events.length} 条
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[500px] overflow-hidden">
            <EventStream 
              events={events} 
              onEventClick={setSelectedEvent}
            />
          </CardContent>
        </Card>

        {/* Right: Stats Dashboard */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">运营指标</CardTitle>
          </CardHeader>
          <CardContent>
            {scenarioState ? (
              <div className="space-y-6">
                {/* 基础指标 */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard 
                    label="总病例数" 
                    value={scenarioState.total_cases} 
                  />
                  <StatCard 
                    label="在院人数" 
                    value={scenarioState.total_inpatients} 
                  />
                  <StatCard 
                    label="总费用" 
                    value={`¥${scenarioState.total_cost.toLocaleString()}`} 
                  />
                  <StatCard 
                    label="DRG 总权重" 
                    value={scenarioState.total_weight.toFixed(2)} 
                  />
                  <StatCard 
                    label="DIP 总点数" 
                    value={scenarioState.total_points.toFixed(1)} 
                  />
                  <StatCard 
                    label="DIP 点值" 
                    value={scenarioState.current_point_value.toFixed(4)} 
                    highlight
                  />
                </div>

                {/* DRG/DIP 双看板 */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* DRG 看板 */}
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-blue-600">DRG 支付模式</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">支付总额</span>
                        <span className="font-mono text-sm font-semibold">¥{scenarioState.pay_drg_total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">成本</span>
                        <span className="font-mono text-sm">¥{scenarioState.total_cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t border-border/30 pt-2">
                        <span className="text-sm font-medium">利润</span>
                        <span className={`font-mono text-sm font-semibold ${
                          scenarioState.margin_drg_total > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ¥{scenarioState.margin_drg_total.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">利润率</span>
                        <span className={`font-mono text-sm ${
                          scenarioState.margin_drg_total > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {scenarioState.total_cost > 0 
                            ? ((scenarioState.margin_drg_total / scenarioState.total_cost) * 100).toFixed(2) 
                            : '0.00'}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DIP 看板 */}
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-green-600">DIP 支付模式</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">支付总额</span>
                        <span className="font-mono text-sm font-semibold">¥{scenarioState.pay_dip_total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">成本</span>
                        <span className="font-mono text-sm">¥{scenarioState.total_cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t border-border/30 pt-2">
                        <span className="text-sm font-medium">利润</span>
                        <span className={`font-mono text-sm font-semibold ${
                          scenarioState.margin_dip_total > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ¥{scenarioState.margin_dip_total.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">利润率</span>
                        <span className={`font-mono text-sm ${
                          scenarioState.margin_dip_total > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {scenarioState.total_cost > 0 
                            ? ((scenarioState.margin_dip_total / scenarioState.total_cost) * 100).toFixed(2) 
                            : '0.00'}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 点值分解看板 */}
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-purple-600">DIP 点值分解</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">预算总额</p>
                      <p className="mt-1 font-mono text-sm font-semibold">¥{scenarioState.params.budget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">区域总点数</p>
                      <p className="mt-1 font-mono text-sm font-semibold">{scenarioState.region_total_points.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">本院乘数</p>
                      <p className="mt-1 font-mono text-sm font-semibold">{scenarioState.multiplier.toFixed(2)}×</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">区域外点数</p>
                      <p className="mt-1 font-mono text-sm font-semibold">{scenarioState.external_points.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border/30 pt-3">
                    <p className="text-xs text-muted-foreground">点值公式</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      点值 = 预算 ÷ (本院点数 × 乘数 + 区域外点数)
                    </p>
                    <p className="mt-1 font-mono text-xs">
                      {scenarioState.current_point_value.toFixed(4)} = {scenarioState.params.budget.toLocaleString()} ÷ 
                      ({scenarioState.total_points.toFixed(1)} × {scenarioState.multiplier.toFixed(2)} + {scenarioState.external_points.toLocaleString()})
                    </p>
                  </div>
                </div>

                {/* 特例单议看板 */}
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-orange-600">特例单议监控</h3>
                    <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      策略: {scenarioState.params.special_strategy === 'uplift' ? '点数上浮' : '按项目付费'}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* 额度使用 */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">额度使用率 (病例数)</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>DRG ({scenarioState.quota_used_drg}/{scenarioState.quota_max_drg})</span>
                          <span>{scenarioState.quota_max_drg > 0 ? ((scenarioState.quota_used_drg / scenarioState.quota_max_drg) * 100).toFixed(1) : 0}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-orange-200 dark:bg-orange-900/30">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, scenarioState.quota_max_drg > 0 ? (scenarioState.quota_used_drg / scenarioState.quota_max_drg) * 100 : 0)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                          <span>DIP ({scenarioState.quota_used_dip}/{scenarioState.quota_max_dip})</span>
                          <span>{scenarioState.quota_max_dip > 0 ? ((scenarioState.quota_used_dip / scenarioState.quota_max_dip) * 100).toFixed(1) : 0}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-orange-200 dark:bg-orange-900/30">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, scenarioState.quota_max_dip > 0 ? (scenarioState.quota_used_dip / scenarioState.quota_max_dip) * 100 : 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 管理效应 */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">管理效应 (额外收益)</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>DRG 增益</span>
                          <span className="font-mono font-medium text-green-600">+¥{scenarioState.management_effect_drg.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>DIP 增益</span>
                          <span className="font-mono font-medium text-green-600">+¥{scenarioState.management_effect_dip.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-orange-200/50 pt-1 mt-1 dark:border-orange-800/30">
                          <span>被拒申请</span>
                          <span className="font-mono font-medium text-red-500">{scenarioState.rejected_special_cases} 例</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 归因解释看板 */}
                {latestExplanation && (
                  <ExplanationCard explanation={latestExplanation} />
                )}

                {/* 支付差异 */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold">DRG vs DIP 支付差异</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Δpay (DIP - DRG)</span>
                    <span className={`font-mono text-lg font-bold ${
                      scenarioState.pay_dip_total - scenarioState.pay_drg_total > 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {scenarioState.pay_dip_total - scenarioState.pay_drg_total > 0 ? '+' : ''}
                      ¥{(scenarioState.pay_dip_total - scenarioState.pay_drg_total).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                <p className="text-sm">启动场景后显示运营指标</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Detail Modal */}
      <EventDetail 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
      />
    </div>
  )
}

// 统计卡片组件
function StatCard({ 
  label, 
  value, 
  highlight = false,
  positive,
}: { 
  label: string
  value: string | number
  highlight?: boolean
  positive?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-primary/50 bg-primary/5' : 'border-border/50'}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${
        positive !== undefined 
          ? positive ? 'text-green-500' : 'text-red-500'
          : ''
      }`}>
        {value}
      </p>
    </div>
  )
}
