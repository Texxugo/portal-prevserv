import type { ReactNode } from "react"

export function ChartCard({
  title,
  empty,
  children,
}: {
  title: string
  empty?: boolean
  children: ReactNode
}) {
  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-5">
        {empty ? (
          <div className="flex min-h-56 items-center justify-center rounded-lg bg-muted/35 text-sm text-muted-foreground">
            Sem dados no periodo
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
