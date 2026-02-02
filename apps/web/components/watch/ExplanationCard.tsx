import { Explanation, Decomposition } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Activity, TrendingUp, Briefcase } from 'lucide-react'

interface ExplanationCardProps {
  explanation: Explanation | null | undefined
}

export function ExplanationCard({ explanation }: ExplanationCardProps) {
  if (!explanation) {
    return (
      <Card className="border-border/50 h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">最新结算归因</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
          暂无结算事件
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          最新结算归因分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* DRG 归因 */}
          <DecompColumn 
            title="DRG 支付构成" 
            total={explanation.delta_total_pay_drg} 
            decomp={explanation.decomp_drg}
            color="blue"
          />
          
          {/* DIP 归因 */}
          <DecompColumn 
            title="DIP 支付构成" 
            total={explanation.delta_total_pay_dip} 
            decomp={explanation.decomp_dip}
            color="green"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function DecompColumn({ 
  title, 
  total, 
  decomp, 
  color 
}: { 
  title: string
  total: number
  decomp: Decomposition
  color: 'blue' | 'green'
}) {
  const textColor = color === 'blue' ? 'text-blue-600' : 'text-green-600'
  const bgColor = color === 'blue' ? 'bg-blue-500' : 'bg-green-500'
  const lightBg = color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'

  return (
    <div className={`rounded-lg border border-border/50 p-3 ${lightBg}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <span className={`font-mono text-sm font-bold ${textColor}`}>
          ¥{total.toLocaleString()}
        </span>
      </div>
      
      <div className="space-y-2">
        <DecompItem 
          label="结构因素 (标准)" 
          value={decomp.structural} 
          icon={<Briefcase className="h-3 w-3" />}
          total={total}
        />
        <DecompItem 
          label="价格因素 (费率)" 
          value={decomp.price} 
          icon={<TrendingUp className="h-3 w-3" />}
          total={total}
        />
        <DecompItem 
          label="管理因素 (特例)" 
          value={decomp.management} 
          icon={<Activity className="h-3 w-3" />}
          total={total}
        />
      </div>
    </div>
  )
}

function DecompItem({ 
  label, 
  value, 
  icon,
  total
}: { 
  label: string
  value: number
  icon: React.ReactNode
  total: number
}) {
  const isZero = Math.abs(value) < 0.01
  const isPositive = value > 0
  
  // 简单的百分比条计算（绝对值占比）
  const percent = total !== 0 ? Math.min(100, Math.abs(value) / Math.abs(total) * 100) : 0
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-mono font-medium ${
          isZero ? 'text-muted-foreground' : 
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {isPositive && !isZero ? '+' : ''}{value.toFixed(2)}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
        <div 
          className={`h-full transition-all ${
            isZero ? 'bg-transparent' : 
            value > 0 ? 'bg-green-500/50' : 'bg-red-500/50'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
