'use client'

import { Event } from '@/lib/api'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface EventDetailProps {
  event: Event | null
  onClose: () => void
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  if (!event) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="mx-4 max-h-[80vh] w-full max-w-lg overflow-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg">{event.type}</CardTitle>
            <CardDescription>{event.ts}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description */}
          <div>
            <h4 className="mb-1 text-sm font-medium text-muted-foreground">描述</h4>
            <p className="text-sm">{event.description}</p>
          </div>

          {/* Case ID */}
          {event.case_id && (
            <div>
              <h4 className="mb-1 text-sm font-medium text-muted-foreground">病例 ID</h4>
              <code className="rounded bg-muted px-2 py-1 text-sm">{event.case_id}</code>
            </div>
          )}

          {/* Payload */}
          <div>
            <h4 className="mb-1 text-sm font-medium text-muted-foreground">Payload</h4>
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>

          {/* Delta */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">Delta (状态增量)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(event.delta).map(([key, value]) => (
                value !== 0 && (
                  <div key={key} className="flex justify-between rounded bg-muted px-2 py-1">
                    <span className="text-muted-foreground">{key}</span>
                    <span className={value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : ''}>
                      {value > 0 ? '+' : ''}{typeof value === 'number' ? value.toLocaleString() : value}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Explanation */}
          {event.explanation && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">支付差异归因</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-600">DRG</span>
                    <span className="font-mono text-blue-600">
                      Δ¥{event.explanation.delta_total_pay_drg.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">结构</span>
                      <span className="font-mono">{event.explanation.decomp_drg.structural.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">价格</span>
                      <span className="font-mono">{event.explanation.decomp_drg.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">管理</span>
                      <span className="font-mono">{event.explanation.decomp_drg.management.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-green-600">DIP</span>
                    <span className="font-mono text-green-600">
                      Δ¥{event.explanation.delta_total_pay_dip.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">结构</span>
                      <span className="font-mono">{event.explanation.decomp_dip.structural.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">价格</span>
                      <span className="font-mono">{event.explanation.decomp_dip.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">管理</span>
                      <span className="font-mono">{event.explanation.decomp_dip.management.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
