'use client'

import { ScenarioState, RegionPackSummary } from '@/lib/api'
import { Play, Pause, RotateCcw, FastForward, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ScenarioControlsProps {
  state: ScenarioState | null
  regions: RegionPackSummary[]
  selectedRegion: string
  seed: number
  isRunning: boolean
  specialStrategy: 'uplift' | 'ffspay'
  specialAggressiveness: number
  onRegionChange: (regionId: string) => void
  onSeedChange: (seed: number) => void
  onSpecialStrategyChange: (strategy: 'uplift' | 'ffspay') => void
  onSpecialAggressivenessChange: (value: number) => void
  onStart: () => void
  onStep: () => void
  onReset: () => void
  onAutoRun: () => void
}

export function ScenarioControls({
  state,
  regions,
  selectedRegion,
  seed,
  isRunning,
  specialStrategy,
  specialAggressiveness,
  onRegionChange,
  onSeedChange,
  onSpecialStrategyChange,
  onSpecialAggressivenessChange,
  onStart,
  onStep,
  onReset,
  onAutoRun,
}: ScenarioControlsProps) {
  const isActive = state !== null
  const isFinished = state?.is_finished ?? false

  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        {/* Region Select */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">地区包:</label>
          <select
            value={selectedRegion}
            onChange={(e) => onRegionChange(e.target.value)}
            disabled={isActive}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Seed Input */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Seed:</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => onSeedChange(parseInt(e.target.value) || 42)}
            disabled={isActive}
            className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          />
        </div>

        {/* Special Case Controls */}
        {!isActive && (
          <>
            <div className="h-6 w-px bg-border" />
            
            {/* Strategy Select */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">特例策略:</label>
              <select
                value={specialStrategy}
                onChange={(e) => onSpecialStrategyChange(e.target.value as 'uplift' | 'ffspay')}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="uplift">点数上浮</option>
                <option value="ffspay">按项目付费</option>
              </select>
            </div>

            {/* Aggressiveness Slider */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">激进程度:</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={specialAggressiveness}
                  onChange={(e) => onSpecialAggressivenessChange(parseFloat(e.target.value))}
                  className="w-24 accent-primary"
                />
                <span className="w-8 text-sm font-mono text-muted-foreground">
                  {specialAggressiveness.toFixed(1)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button onClick={onStart} size="sm">
              <Play className="mr-2 h-4 w-4" />
              启动场景
            </Button>
          ) : (
            <>
              <Button onClick={onStep} size="sm" disabled={isFinished || isRunning}>
                <Play className="mr-2 h-4 w-4" />
                推进
              </Button>
              <Button onClick={onAutoRun} size="sm" variant="outline" disabled={isFinished}>
                {isRunning ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <FastForward className="mr-2 h-4 w-4" />
                    自动
                  </>
                )}
              </Button>
              <Button onClick={onReset} size="sm" variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </Button>
            </>
          )}
        </div>

        {/* Status */}
        {state && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Day {state.current_day} · {state.current_batch}
              </span>
              <span>
                病例: <strong>{state.total_cases}</strong>
              </span>
              <span>
                在院: <strong>{state.total_inpatients}</strong>
              </span>
              {isFinished && (
                <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
                  已完成
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
