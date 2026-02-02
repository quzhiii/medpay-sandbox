'use client'

import { 
  Link2, 
  GitCompare, 
  ScrollText, 
  PieChart, 
  Puzzle 
} from 'lucide-react'
import { Hero } from '@/components/home/Hero'
import { FeatureCard } from '@/components/home/FeatureCard'

const features = [
  {
    icon: Link2,
    title: '规则可追溯',
    description: '每个参数标注来源（官方文件 / 本地政策 / 假设），支持证据链浏览与版本追踪。',
  },
  {
    icon: GitCompare,
    title: '双规则对照',
    description: 'DRG 与 DIP 双引擎并行运算，同一病例可直观对比两种支付模式的差异与成因。',
  },
  {
    icon: ScrollText,
    title: '事件账本可回放',
    description: '完整记录仿真过程中的每一条事件，支持暂停、倍速、回放与导出复现。',
  },
  {
    icon: PieChart,
    title: '可解释归因',
    description: '每次指标变化自动分解为结构效应、价格效应、管理效应，数值可加总验证。',
  },
  {
    icon: Puzzle,
    title: 'RegionPack 插件扩展',
    description: '地区规则以 YAML 插件形式存在，热插拔加载，支持多统筹区政策差异化配置。',
  },
]

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Features Section */}
      <section className="border-t border-border/40 py-16 lg:py-24">
        <div className="container max-w-screen-2xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              核心能力
            </h2>
            <p className="text-muted-foreground">
              为学术研究与政策分析提供严谨、可验证的仿真基础设施
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Academic Collaboration Section */}
      <section className="border-t border-border/40 py-16 lg:py-24">
        <div className="container max-w-screen-2xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              学术合作
            </h2>
            <p className="mb-6 text-muted-foreground">
              本系统可用于课堂教学、学术研究与政策模拟。欢迎引用或联系合作。
            </p>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-left font-mono text-sm">
              <p className="text-muted-foreground">建议引用格式：</p>
              <p className="mt-2">
                MedPay Sandbox (v0.1.0). 医保支付改革机制沙盘推演工具. 2025.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
