import { cn } from "@/lib/utils"

export type DonutChartItem = {
  label: string
  value: number
  colorClass: string
}

export function DonutChart({
  data,
  note,
}: {
  data: DonutChartItem[]
  note?: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const arcs = data.map((item, index) => {
    const previous = data
      .slice(0, index)
      .reduce((sum, previousItem) => sum + previousItem.value, 0)
    const length = (item.value / total) * circumference

    return {
      ...item,
      dash: `${length} ${circumference - length}`,
      offset: -(previous / total) * circumference,
    }
  })

  return (
    <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
      <svg viewBox="0 0 160 160" role="img" aria-label="Grafico de rosca" className="mx-auto size-44">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          strokeWidth="18"
          className="stroke-muted"
        />
        {arcs.map((item) => {
          return (
            <circle
              key={item.label}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              strokeWidth="18"
              strokeDasharray={item.dash}
              strokeDashoffset={item.offset}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
              className={cn("stroke-current", item.colorClass)}
            />
          )
        })}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-foreground text-2xl font-semibold"
        >
          {total}
        </text>
        <text
          x="80"
          y="96"
          textAnchor="middle"
          className="fill-muted-foreground text-[12px]"
        >
          total
        </text>
      </svg>

      <div className="space-y-2">
        {data.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
          return (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <span className={cn("size-3 rounded-sm bg-current", item.colorClass)} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {item.label}
              </span>
              <span className="font-medium">
                {item.value} ({percent}%)
              </span>
            </div>
          )
        })}
        {note && <p className="pt-2 text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}
