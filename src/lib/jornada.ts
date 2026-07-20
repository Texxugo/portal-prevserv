// Jornada semanal do colaborador. Chaves "0".."6" = dia da semana (0=Domingo … 6=Sábado,
// igual a Date.getUTCDay()). Dia ausente ou null = folga. Horários "HH:MM".

export type DaySchedule = {
  entrada?: string
  almocoSaida?: string
  almocoVolta?: string
  saida?: string
}

export type WeeklySchedule = Record<string, DaySchedule | null>

// Ordem de exibição (começa na segunda).
export const WEEKDAYS: { key: string; label: string }[] = [
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" },
  { key: "0", label: "Domingo" },
]

export const SCHEDULE_FIELDS: { key: keyof DaySchedule; label: string }[] = [
  { key: "entrada", label: "Entrada" },
  { key: "almocoSaida", label: "Saída almoço" },
  { key: "almocoVolta", label: "Volta almoço" },
  { key: "saida", label: "Saída" },
]

export function parseSchedule(
  json: string | null | undefined
): WeeklySchedule | null {
  if (!json) return null
  try {
    const obj = JSON.parse(json)
    if (obj && typeof obj === "object") return obj as WeeklySchedule
  } catch {
    // ignora JSON inválido
  }
  return null
}

export function scheduleForDate(
  ws: WeeklySchedule | null,
  date: Date
): DaySchedule | null {
  if (!ws) return null
  return ws[String(date.getUTCDay())] ?? null
}

export function hasAnySchedule(ws: WeeklySchedule | null): boolean {
  if (!ws) return false
  return Object.values(ws).some(
    (d) => d && (d.entrada || d.saida || d.almocoSaida || d.almocoVolta)
  )
}

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

function cycleHasSchedule(cycle: CycleSchedule | null): boolean {
  return (
    !!cycle &&
    cycle.some((d) => d && (d.entrada || d.saida || d.almocoSaida || d.almocoVolta))
  )
}

// Entrada usada para resolver a jornada de um colaborador (escala tem prioridade).
export type ScheduleSource = {
  workSchedule: string | null
  escalaInicio: Date | null
  escala: { cycleDays: string } | null
}

// Select Prisma de Employee com os campos de ScheduleSource + identificação.
export const EMPLOYEE_JORNADA_SELECT = {
  id: true,
  name: true,
  matricula: true,
  workSchedule: true,
  escalaInicio: true,
  escala: { select: { cycleDays: true } },
} as const

// Retorna a função que dá a jornada esperada de qualquer data (escala+âncora ou semanal).
export function buildDayResolver(
  emp: ScheduleSource
): (date: Date) => DaySchedule | null {
  if (emp.escala && emp.escalaInicio) {
    const cycle = parseCycle(emp.escala.cycleDays)
    if (cycleHasSchedule(cycle)) {
      const anchor = emp.escalaInicio
      return (date) => scheduleForCycle(cycle!, anchor, date)
    }
  }
  const ws = parseSchedule(emp.workSchedule)
  return (date) => scheduleForDate(ws, date)
}

export function hasResolverSchedule(emp: ScheduleSource): boolean {
  if (emp.escala && emp.escalaInicio) {
    if (cycleHasSchedule(parseCycle(emp.escala.cycleDays))) return true
  }
  return hasAnySchedule(parseSchedule(emp.workSchedule))
}
