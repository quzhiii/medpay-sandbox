'use client'

import { useEffect, useState } from 'react'
import { 
  BookOpen, 
  Link2, 
  AlertCircle, 
  Database, 
  Loader2, 
  RefreshCw, 
  ChevronDown, 
  Download,
  Scale,
  Activity,
  GitCommit,
  FileDigit,
  ShieldAlert
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, type RegionPackSummary, type RegionPack, type EvidenceCard } from '@/lib/api'

// --- Constants & Config ---

const METHOD_SECTIONS = [
  {
    icon: Database,
    title: '事件账本系统',
    description: '完整记录仿真过程中的每一条事件（入院、诊疗、出院、结算等），构建不可篡改的医疗行为轨迹，支持全流程回放与数据审计。',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    icon: Scale,
    title: '双引擎对照',
    description: 'DRG 与 DIP 支付引擎实时并行运算，针对同一病案实例进行即时支付对比，精确量化两种支付模式下的盈亏差异与政策导向。',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    icon: Activity,
    title: '点值分母假设',
    description: '动态模拟 DIP 点值计算逻辑（点值 = 预算 / 区域总分值）。在 UI 中实时展示分母假设对最终支付的影响，支持敏感性滑条调节。',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
  {
    icon: AlertCircle,
    title: '解释器分解',
    description: '运用归因分析模型，将支付变动层层分解为：结构效应（CMI变化）、价格效应（费率/点值波动）与管理效应（特例单议/拒付）。',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10'
  },
  {
    icon: Download,
    title: '可复现导出',
    description: '所有仿真参数、随机种子与结果数据均可导出为标准 JSON/CSV 格式，构建完整的证据链闭环，确保研究结果可复现、可验证。',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  }
]

const SOURCE_CONFIG = {
  official: { 
    label: '官方文件', 
    short: '官',
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    border: 'border-emerald-200 dark:border-emerald-800'
  },
  local_doc: { 
    label: '本地政策', 
    short: '本',
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-100 dark:bg-blue-950/50',
    border: 'border-blue-200 dark:border-blue-800'
  },
  assumption: { 
    label: '仿真假设', 
    short: '假',
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-800'
  }
}

// --- Components ---

function SourceBadge({ type, count }: { type: keyof typeof SOURCE_CONFIG; count?: number }) {
  const config = SOURCE_CONFIG[type]
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${config.bg} ${config.color} ${config.border}`}>
      <span className="font-bold">{config.short}</span>
      <span>{config.label}</span>
      {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
    </div>
  )
}

function EvidenceItem({ item }: { item: EvidenceCard }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = SOURCE_CONFIG[item.source_type]

  return (
    <div 
      className={`group overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md ${isExpanded ? 'ring-1 ring-primary/20' : 'hover:border-primary/50'}`}
    >
      <button 
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left"
        aria-expanded={isExpanded}
      >
        {/* Icon / Status Indicator */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${config.bg} ${config.border}`}>
          <span className={`text-sm font-bold ${config.color}`}>{config.short}</span>
        </div>

        {/* Main Content Header */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-mono text-sm font-semibold tracking-tight text-foreground truncate">
              {item.param_key}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
              {item.publish_date || 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <p className="text-sm text-muted-foreground truncate max-w-[80%]">
              {item.source_title || '未命名来源'}
            </p>
          </div>
        </div>

        {/* Chevron */}
        <div className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </button>

      <div 
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div 
            className={`border-t bg-muted/30 px-4 py-4 text-sm transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">摘录内容</span>
                  <p className="mt-1 leading-relaxed text-foreground/90 font-serif border-l-2 border-primary/20 pl-3">
                    {item.excerpt}
                  </p>
                </div>
                {item.notes && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">分析备注</span>
                    <p className="mt-1 text-muted-foreground">{item.notes}</p>
                  </div>
                )}
              </div>
              <div className="space-y-3 text-xs">
                <div className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">来源类型</span>
                    <span className="font-medium">{SOURCE_CONFIG[item.source_type].label}</span>
                  </div>
                  {item.source_url && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">原始链接</span>
                      <a 
                        href={item.source_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        查看原文 <Link2 className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MethodPage() {
  const [regions, setRegions] = useState<RegionPackSummary[]>([])
  const [selectedRegion, setSelectedRegion] = useState<RegionPack | null>(null)
  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Load summaries
  const loadRegions = async () => {
    setLoadingRegions(true)
    setError(null)
    try {
      const data = await api.getRegions()
      setRegions(data)
      // Auto-select first region if available and none selected
      if (data.length > 0 && !selectedRegion) {
        loadRegionDetail(data[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoadingRegions(false)
    }
  }

  // Load specific region details (with evidence)
  const loadRegionDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      const data = await api.getRegion(id)
      setSelectedRegion(data)
    } catch (e) {
      console.error('Failed to load region detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    loadRegions()
  }, [])

  const evidence = selectedRegion?.evidence ?? []
  const evidenceSorted = [...evidence].sort((a, b) => a.param_key.localeCompare(b.param_key))
  const evidenceByType = {
    official: evidenceSorted.filter((item) => item.source_type === 'official'),
    local_doc: evidenceSorted.filter((item) => item.source_type === 'local_doc'),
    assumption: evidenceSorted.filter((item) => item.source_type === 'assumption'),
  }
  const totalEvidence = evidence.length

  return (
    <div className="container max-w-screen-xl py-10 space-y-12">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/80">
            <GitCommit className="h-5 w-5" />
            <span className="text-sm font-mono font-medium tracking-wider uppercase">System Methodology</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">方法论与证据链</h1>
          <p className="text-muted-foreground max-w-2xl text-lg">
            基于真实世界数据的仿真系统。透明展示核心算法逻辑，建立完整的参数来源证据链。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRegions} disabled={loadingRegions}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingRegions ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>
      </div>

      {/* Methodology Grid */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">核心架构</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {METHOD_SECTIONS.map((section) => (
            <Card key={section.title} className="group overflow-hidden border-border/50 bg-gradient-to-br from-card to-muted/20 transition-all hover:border-border hover:shadow-sm">
              <CardHeader className="pb-3">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${section.bg} ${section.color}`}>
                  <section.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">
                  {section.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Evidence Chain Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">证据链追踪</h2>
          </div>
          
          {/* Region Selector (Simple list if few, or dropdown) */}
          {regions.length > 0 && (
             <div className="flex items-center gap-2">
               <span className="text-sm text-muted-foreground">当前地区包:</span>
               <div className="flex gap-1">
                 {regions.map(r => (
                   <Button
                    key={r.id}
                    variant={selectedRegion?.id === r.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => loadRegionDetail(r.id)}
                    className="h-8 text-xs"
                   >
                    {r.name}
                   </Button>
                 ))}
               </div>
             </div>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            <p>无法加载数据: {error}</p>
          </div>
        ) : loadingDetail ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          </div>
        ) : selectedRegion ? (
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            
            {/* Sidebar Stats */}
            <div className="space-y-6">
              <Card className="border-border/50 bg-muted/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    数据来源构成
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(SOURCE_CONFIG).map(([type, config]) => {
                    const typedEvidence = evidenceByType[type as keyof typeof evidenceByType]
                    const count = typedEvidence.length

                    let colorClass = 'bg-gray-500'
                    if (type === 'official') colorClass = 'bg-emerald-500'
                    if (type === 'local_doc') colorClass = 'bg-blue-500'
                    if (type === 'assumption') colorClass = 'bg-amber-500'

                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${colorClass}`}></span>
                            {config.label}
                          </span>
                          <span className="font-mono font-medium">{count}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div 
                            className={`h-full ${colorClass}`} 
                            style={{ width: `${totalEvidence > 0 ? (count / totalEvidence) * 100 : 0}%` }}
                          />
                        </div>
                        {count === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground/60">暂无对应参数</p>
                        ) : (
                          <div className="mt-2 pl-3 border-l-2 border-muted space-y-1">
                            {typedEvidence.map((item, idx) => (
                              <div key={`${item.param_key}-${idx}`} className="text-xs text-muted-foreground/80 truncate font-mono hover:text-foreground transition-colors cursor-help" title={item.param_key}>
                                {item.param_key}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">名称</span>
                    <span className="font-medium">{selectedRegion.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                     <span className="text-muted-foreground">级别</span>
                    <span>{selectedRegion.region_level}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                     <span className="text-muted-foreground">支付方式</span>
                    <span className="uppercase">{selectedRegion.payment_primary}</span>
                  </div>
                  <div className="flex justify-between py-1 pt-2">
                     <span className="text-muted-foreground">政策版本</span>
                    <span className="font-mono">{selectedRegion.policy_version}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evidence List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2">
                <span className="text-sm text-muted-foreground">
                  共找到 <span className="font-medium text-foreground">{totalEvidence}</span> 条参数证据
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileDigit className="h-3.5 w-3.5" />
                  按参数键名排序
                </div>
              </div>

                  {totalEvidence === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
                      <p className="text-muted-foreground">暂无证据记录</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {evidenceSorted.map((item, idx) => (
                        <EvidenceItem key={`${item.param_key}-${idx}`} item={item} />
                      ))}
                    </div>
                  )}
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/10">
            <div className="text-center">
              <Database className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">未选择地区包或暂无数据</p>
              <Button variant="link" onClick={loadRegions}>重试加载</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
