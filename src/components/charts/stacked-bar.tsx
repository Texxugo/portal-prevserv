import { cn } from "@/lib/utils"

export type StackedBarSegment = {
  label: string
  value: number
  colorClass: string
}

export function StackedBar({ segments }: { segments: StackedBarSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const closed = segments.find((segment) => segment.label === "Encerrado")?.value ?? 0
  const closedPercent = total > 0 ? Math.round((closed / total) * 100) : 0

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">Progresso encerrado</p>
          <p className="text-2xl font-semibold">{closedPercent}%</p>
        </div>
        <div className="flex h-9 overflow-hidden rounded-lg bg-muted">
          {segments.map((segment) => {
            const width = total > 0 ? (segment.value / total) * 100 : 0
            return (
              <div
                key={segment.label}
                className={cn("h-full bg-current", segment.colorClass)}
                style={{ width: `${width}%` }}
                aria-label={`${segment.label}: ${segment.value}`}
              />
            )
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {segments.map((segment) => {
          const percent = total > 0 ? Math.round((segment.value / total) * 100) : 0
          return (
            <div key={segment.label} className="rounded-lg bg-muted/35 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={cn("size-3 rounded-sm bg-current", segment.colorClass)} />
                {segment.label}
              </div>
              <p className="mt-1 text-xl font-semibold">
                {segment.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {percent}%
                </span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
