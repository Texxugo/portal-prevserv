"use client"

import { useState } from "react"

import {
  parseSchedule,
  SCHEDULE_FIELDS,
  WEEKDAYS,
  type DaySchedule,
  type WeeklySchedule,
} from "@/lib/jornada"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Vira a meia-noite quando saída < entrada (ex.: 18:00→06:00). Horários "HH:MM" 24h
// comparam corretamente como string.
function isVirada(day: DaySchedule): boolean {
  return !!day.entrada && !!day.saida && day.saida < day.entrada
}

export function ScheduleEditor({
  defaultValue,
}: {
  defaultValue?: string | null
}) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(
    () => parseSchedule(defaultValue ?? null) ?? {}
  )

  function update(dayKey: string, field: keyof DaySchedule, value: string) {
    setSchedule((prev) => {
      const day: DaySchedule = { ...(prev[dayKey] ?? {}) }
      if (value) day[field] = value
      else delete day[field]
      const next = { ...prev }
      if (Object.keys(day).length === 0) delete next[dayKey]
      else next[dayKey] = day
      return next
    })
  }

  return (
    <div className="space-y-2">
      <Label>Jornada (horários esperados por dia)</Label>
      <p className="text-sm text-muted-foreground">
        Deixe os campos do dia em branco para folga. Almoço é opcional.
      </p>
      <input type="hidden" name="workSchedule" value={JSON.stringify(schedule)} />
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
            {WEEKDAYS.map(({ key, label }) => {
              const day = schedule[key] ?? {}
              return (
                <tr key={key} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {label}
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
                        value={day[f.key] ?? ""}
                        onChange={(e) => update(key, f.key, e.target.value)}
                        className="w-32"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
