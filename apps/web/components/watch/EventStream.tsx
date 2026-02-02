'use client'

import { Event, EventType } from '@/lib/api'
import { 
  UserPlus, 
  Building2, 
  Stethoscope, 
  LogOut, 
  Layers, 
  CreditCard,
  AlertCircle 
} from 'lucide-react'

const EVENT_ICONS: Record<EventType, typeof UserPlus> = {
  ARRIVAL: UserPlus,
  ADMIT: Building2,
  PROCEDURE: Stethoscope,
  DISCHARGE: LogOut,
  GROUPING: Layers,
  SETTLE: CreditCard,
  AUDIT: AlertCircle,
}

const EVENT_COLORS: Record<EventType, string> = {
  ARRIVAL: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ADMIT: 'bg-green-500/10 text-green-500 border-green-500/20',
  PROCEDURE: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  DISCHARGE: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  GROUPING: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  SETTLE: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  AUDIT: 'bg-red-500/10 text-red-500 border-red-500/20',
}

interface EventStreamProps {
  events: Event[]
  onEventClick?: (event: Event) => void
}

export function EventStream({ events, onEventClick }: EventStreamProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">暂无事件，点击"推进"开始仿真</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 overflow-y-auto pr-2">
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.type]
        const colorClass = EVENT_COLORS[event.type]
        
        return (
          <div
            key={event.event_id}
            onClick={() => onEventClick?.(event)}
            className={`
              flex cursor-pointer items-start gap-3 rounded-lg border p-3 
              transition-colors hover:bg-muted/50
              ${colorClass}
            `}
          >
            <div className="mt-0.5 shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{event.ts}</span>
                <span className="text-xs opacity-70">{event.type}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed opacity-90">
                {event.description}
              </p>
              {event.case_id && (
                <span className="mt-1 inline-block rounded bg-background/50 px-1.5 py-0.5 text-xs font-mono">
                  {event.case_id}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
