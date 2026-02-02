'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 mx-0 max-w-none overflow-hidden">
        <div className="absolute left-1/2 top-0 ml-[-38rem] h-[25rem] w-[81.25rem] dark:[mask-image:linear-gradient(white,transparent)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#36b49f] to-[#DBFF75] opacity-40 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] dark:from-[#36b49f]/30 dark:to-[#DBFF75]/30 dark:opacity-100" />
        </div>
      </div>

      <div className="container max-w-screen-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Badge */}
          <div className="mb-6 inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-sm">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500" />
            机制推演 · 教学研究辅助工具
          </div>

          {/* Title */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">医保沙盘</span>
            <span className="block text-2xl font-normal text-muted-foreground sm:text-3xl lg:text-4xl">
              MedPay Sandbox
            </span>
          </h1>

          {/* Description */}
          <p className="mb-8 text-lg text-muted-foreground lg:text-xl">
            用可追溯规则与可复现实验，解释 DRG/DIP 如何通过预算、点值/费率与病例结构影响医院运营结果。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href="/watch">
                进入监视屏幕
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/method">查看方法论</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
