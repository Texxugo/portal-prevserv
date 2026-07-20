import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "default",
}: {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  href?: string
  tone?: "default" | "positive" | "negative"
}) {
  const content = (
    <>
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
          tone === "positive" &&
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "bg-destructive/10 text-destructive"
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </>
  )

  const className = cn(
    "flex items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10",
    href && "transition-colors hover:bg-muted/50"
  )

  return href ? (
    <Link href={href} className={className}>{content}</Link>
  ) : (
    <div className={className}>{content}</div>
  )
}
