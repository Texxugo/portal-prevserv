import { cn } from "@/lib/utils"

export type BarChartItem = {
  label: string
  value: number
  colorClass: string
}

export function BarChart({ data }: { data: BarChartItem[] }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  const width = 480
  const height = 260
  const padding = { top: 28, right: 12, bottom: 62, left: 12 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const gap = 12
  const barWidth = Math.max(18, (plotWidth - gap * (data.length - 1)) / data.length)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Grafico de barras"
      className="h-72 w-full overflow-visible"
    >
      <line
        x1={padding.left}
        y1={padding.top + plotHeight}
        x2={width - padding.right}
        y2={padding.top + plotHeight}
        className="stroke-border"
      />
      {data.map((item, index) => {
        const barHeight = item.value === 0 ? 0 : Math.max(8, (item.value / max) * plotHeight)
        const x = padding.left + index * (barWidth + gap)
        const y = padding.top + plotHeight - barHeight

        return (
          <g key={item.label}>
            <text
              x={x + barWidth / 2}
              y={Math.max(16, y - 8)}
              textAnchor="middle"
              className="fill-foreground text-[15px] font-semibold"
            >
              {item.value}
            </text>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="6"
              className={cn("fill-current", item.colorClass)}
            />
            <text
              x={x + barWidth / 2}
              y={padding.top + plotHeight + 22}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {item.label.split(" ").map((word, line) => (
                <tspan key={word} x={x + barWidth / 2} dy={line === 0 ? 0 : 13}>
                  {word}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
