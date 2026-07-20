"use client"

import {
  SCHEDULE_FIELDS,
  type CycleSchedule,
  type DaySchedule,
} from "@/lib/jornada"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Vira a meia-noite quando saída < entrada (ex.: 18:00→06:00). Horários "HH:MM" 24h
// comparam corretamente como string.
function isVirada(day: DaySchedule | null | undefined): boolean {
  return !!day?.entrada && !!day?.saida && day.saida < day.entrada
}

export function CycleEditor({
  value,
  onChange,
}: {
  value: CycleSchedule
  onChange: (c: CycleSchedule) => void
}) {
  function setLength(raw: number) {
    const n = Math.max(1, Math.min(31, raw || 1))
    const next = value.slice(0, n)
    while (next.length < n) next.push(null)
    onChange(next)
  }

  function updateDay(idx: number, field: keyof DaySchedule, v: string) {
    onChange(
      value.map((d, i) => {
        if (i !== idx) return d
        const day: DaySchedule = { ...(d ?? {}) }
        if (v) day[field] = v
        else delete day[field]
        return Object.keys(day).length === 0 ? null : day
      })
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="cyclen">Dias no ciclo</Label>
          <Input
            id="cyclen"
            type="number"
            min={1}
            max={31}
            value={value.length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-28"
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          Deixe os campos do dia em branco para folga.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Dia</th>
              {SCHEDULE_FIELDS.map((f) => (
                <th key={f.key} className="px-3 py-2 text-left font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.map((day, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">
                  Dia {i + 1}
                  {isVirada(day) && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                      🌙 vira a noite
                    </span>
                  )}
                </td>
                {SCHEDULE_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-1">
                    <Input
                      type="time"
                      value={day?.[f.key] ?? ""}
                      onChange={(e) => updateDay(i, f.key, e.target.value)}
                      className="w-32"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
