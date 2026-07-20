// Competência: período do dia 21 ao dia 20 do mês seguinte, rotulado pelo
// mês de FECHAMENTO (dia 20). Ex.: 25/06 → "2026-07"; 10/06 → "2026-06".
// Conceito genérico — reutilizável por qualquer módulo que precise filtrar por competência.

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

// Datas são "date-only" armazenadas em UTC — usar getters UTC.
export function competenciaFromDate(date: Date): string {
  const day = date.getUTCDate()
  let year = date.getUTCFullYear()
  let month = date.getUTCMonth() // 0-11
  if (day >= 21) {
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

export function currentCompetencia(now: Date = new Date()): string {
  return competenciaFromDate(now)
}

export function lastCompetencias(n: number): string[] {
  const [y, m] = currentCompetencia().split("-").map(Number)
  const out: string[] = []
  let yy = y
  let mm = m

  for (let i = 0; i < n; i++) {
    out.push(`${yy}-${String(mm).padStart(2, "0")}`)
    mm--
    if (mm < 1) {
      mm = 12
      yy--
    }
  }

  return out
}

export function competenciaLabel(competencia: string): string {
  const [year, month] = competencia.split("-").map(Number)
  if (!year || !month || month < 1 || month > 12) return competencia
  return `${MESES[month - 1]}/${year}`
}

// Período (início/fim) de uma competência "YYYY-MM": dia 21 do mês anterior a dia 20 deste mês.
export function competenciaRange(competencia: string): { start: Date; end: Date } {
  const [year, month] = competencia.split("-").map(Number)
  const end = new Date(Date.UTC(year, month - 1, 20))
  const start = new Date(Date.UTC(year, month - 2, 21))
  return { start, end }
}

export type CompetenciaOption = { value: string; label: string }

// Opções de um seletor de competência: as existentes ∪ a selecionada, desc.
export function competenciaSelectOptions(
  existentes: Iterable<string | null | undefined>,
  selecionada?: string
): CompetenciaOption[] {
  const set = new Set<string>()
  for (const c of existentes) if (c) set.add(c)
  if (selecionada) set.add(selecionada)
  return Array.from(set)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: competenciaLabel(value) }))
}
