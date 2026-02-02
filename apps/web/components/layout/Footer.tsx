export function Footer() {
  return (
    <footer className="border-t border-border/40 py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          <span className="font-medium">免责声明：</span>
          本系统仅用于机制推演、教学研究与政策模拟，不代表真实医保结算结果，不可作为报销凭证或经营决策依据。
        </p>
        <p className="text-sm text-muted-foreground">
          © 2025 MedPay Sandbox · v0.1.0
        </p>
      </div>
    </footer>
  )
}
