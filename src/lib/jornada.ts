// Jornada do colaborador. Horários "HH:MM"; dia sem horários = folga.

export type DaySchedule = {
  entrada?: string
  almocoSaida?: string
  almocoVolta?: string
  saida?: string
}

export const SCHEDULE_FIELDS: { key: keyof DaySchedule; label: string }[] = [
  { key: "entrada", label: "Entrada" },
  { key: "almocoSaida", label: "Saída almoço" },
  { key: "almocoVolta", label: "Volta almoço" },
  { key: "saida", label: "Saída" },
]

// ---------- Escala rotativa (ciclo de N dias ancorado numa data) ----------

export type CycleSchedule = (DaySchedule | null)[]

export function parseCycle(json: string | null | undefined): CycleSchedule | null {
  if (!json) return null
  try {
    const arr = JSON.parse(json)
    if (Array.isArray(arr)) return arr as CycleSchedule
  } catch {
    // ignora JSON inválido
  }
  return null
}

const DAY_MS = 86_400_000

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function scheduleForCycle(
  cycle: CycleSchedule,
  anchor: Date,
  date: Date
): DaySchedule | null {
  const n = cycle.length
  if (n === 0) return null
  const diff = Math.floor((utcMidnight(date) - utcMidnight(anchor)) / DAY_MS)
  const idx = ((diff % n) + n) % n
  return cycle[idx] ?? null
}

function cycleHasSchedule(cycle: CycleSchedule | null): cycle is CycleSchedule {
  return (
    !!cycle &&
    cycle.some((d) => d && (d.entrada || d.saida || d.almocoSaida || d.almocoVolta))
  )
}

// Entrada usada para resolver a jornada de um colaborador. A escala rotativa é a
// única origem de jornada — a semanal fixa saiu do cadastro.
export type ScheduleSource = {
  escalaInicio: Date | null
  escala: { cycleDays: string } | null
}

// Select Prisma de Employee com os campos de ScheduleSource + identificação.
export const EMPLOYEE_JORNADA_SELECT = {
  id: true,
  name: true,
  matricula: true,
  escalaInicio: true,
  escala: { select: { cycleDays: true } },
} as const

// Retorna a função que dá a jornada esperada de qualquer data (escala + âncora).
export function buildDayResolver(
  emp: ScheduleSource
): (date: Date) => DaySchedule | null {
  if (emp.escala && emp.escalaInicio) {
    const cycle = parseCycle(emp.escala.cycleDays)
    if (cycleHasSchedule(cycle)) {
      const anchor = emp.escalaInicio
      return (date) => scheduleForCycle(cycle, anchor, date)
    }
  }
  return () => null
}

export function hasResolverSchedule(emp: ScheduleSource): boolean {
  if (!emp.escala || !emp.escalaInicio) return false
  return cycleHasSchedule(parseCycle(emp.escala.cycleDays))
}
