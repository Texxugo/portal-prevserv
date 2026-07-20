import type { DaySchedule } from "@/lib/jornada"
import { competenciaRange } from "../competencia"
import type { EspelhoDia } from "./parse-qyon"

// Resolve a jornada esperada de uma data (semanal fixa ou escala rotativa).
export type DayResolver = (date: Date) => DaySchedule | null

export type OcorrenciaTipo =
  | "IMPAR"
  | "FALTA"
  | "ATRASO"
  | "SAIDA_ANTECIPADA"
  | "HORA_EXTRA"
  | "INTERVALO"

export type Ocorrencia = {
  data: Date
  tipo: OcorrenciaTipo
  detalhe: string
  marcacoes: string[]
}

export const JUSTIFICATIVA_CATEGORIAS = [
  "Atestado",
  "Feriado",
  "Abono",
  "Banco de horas",
  "Esquecimento",
  "Troca Interna",
  "Troca de Turno",
  "Troca de Escala",
  "Período Incompleto",
  "Férias",
  "Outro",
] as const

export const OCORRENCIA_LABEL: Record<OcorrenciaTipo, string> = {
  IMPAR: "Marcação incompleta",
  FALTA: "Falta",
  ATRASO: "Atraso",
  SAIDA_ANTECIPADA: "Saída antecipada",
  HORA_EXTRA: "Hora extra",
  INTERVALO: "Intervalo",
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

const dateKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`

// Detecta os pontos de atenção varrendo o período da competência (21→20), usando as
// marcações do arquivo + a jornada. Assim FALTA é detectada mesmo quando o relatório não
// lista os dias sem batida (caso do "Marcações Realizadas Simplificadas").
// `inicioPeriodo`/`fimPeriodo` limitam a varredura ao período coberto pelo relatório
// (acompanhamento diário com arquivos parciais, ex.: 30→04) — sem eles, dias fora do
// arquivo virariam falta fantasma.
export function detectarOcorrencias(
  dias: EspelhoDia[],
  resolveDay: DayResolver,
  tolerancia: number,
  competencia: string,
  tiposAtivos?: Set<string>,
  now: Date = new Date(),
  fimPeriodo?: Date | null,
  inicioPeriodo?: Date | null
): Ocorrencia[] {
  const out: Ocorrencia[] = []

  const marksByDate = new Map<string, string[]>()
  for (const d of dias) marksByDate.set(dateKey(d.data), d.marcacoes)

  const range = competenciaRange(competencia)
  const endTime = Date.UTC(
    range.end.getUTCFullYear(),
    range.end.getUTCMonth(),
    range.end.getUTCDate()
  )
  // Só considera dias já completos: até ontem. Nunca detecta falta em dia futuro/em andamento.
  const yesterdayTime =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86_400_000
  const fimPeriodoTime = fimPeriodo
    ? Date.UTC(
        fimPeriodo.getUTCFullYear(),
        fimPeriodo.getUTCMonth(),
        fimPeriodo.getUTCDate()
      )
    : Infinity
  const lastTime = Math.min(endTime, yesterdayTime, fimPeriodoTime)
  const startTime = Date.UTC(
    range.start.getUTCFullYear(),
    range.start.getUTCMonth(),
    range.start.getUTCDate()
  )
  const inicioPeriodoTime = inicioPeriodo
    ? Date.UTC(
        inicioPeriodo.getUTCFullYear(),
        inicioPeriodo.getUTCMonth(),
        inicioPeriodo.getUTCDate()
      )
    : -Infinity
  const cursor = new Date(Math.max(startTime, inicioPeriodoTime))

  while (cursor.getTime() <= lastTime) {
    const data = new Date(cursor.getTime())
    cursor.setUTCDate(cursor.getUTCDate() + 1)

    const marc = marksByDate.get(dateKey(data)) ?? []
    const sched = resolveDay(data)

    // Folga: marcação em dia sem jornada = trabalho em folga
    if (!sched || (!sched.entrada && !sched.saida)) {
      if (marc.length > 0) {
        out.push({
          data,
          tipo: "HORA_EXTRA",
          detalhe: `Trabalho em dia de folga (${marc.join(" ")})`,
          marcacoes: marc,
        })
      }
      continue
    }

    if (marc.length === 0) {
      out.push({ data, tipo: "FALTA", detalhe: "Dia útil sem batida", marcacoes: [] })
      continue
    }

    if (marc.length % 2 !== 0) {
      // Último dia varrido + turno noturno: a saída cai fora do período do relatório
      // (madrugada seguinte) — jornada em aberto não é marcação incompleta.
      const noturno =
        !!sched.entrada && !!sched.saida && toMin(sched.saida) < toMin(sched.entrada)
      if (noturno && data.getTime() === lastTime) continue
      out.push({
        data,
        tipo: "IMPAR",
        detalhe: `Marcação incompleta (${marc.length} batidas)`,
        marcacoes: marc,
      })
      continue
    }

    const first = toMin(marc[0])
    const last = toMin(marc[marc.length - 1])

    if (sched.entrada && first > toMin(sched.entrada) + tolerancia) {
      out.push({
        data,
        tipo: "ATRASO",
        detalhe: `Entrada esperada ${sched.entrada}, real ${marc[0]}`,
        marcacoes: marc,
      })
    }

    if (sched.saida) {
      const exp = toMin(sched.saida)
      if (last < exp - tolerancia) {
        out.push({
          data,
          tipo: "SAIDA_ANTECIPADA",
          detalhe: `Saída esperada ${sched.saida}, real ${marc[marc.length - 1]}`,
          marcacoes: marc,
        })
      } else if (last > exp + tolerancia) {
        out.push({
          data,
          tipo: "HORA_EXTRA",
          detalhe: `Saída esperada ${sched.saida}, real ${marc[marc.length - 1]}`,
          marcacoes: marc,
        })
      }
    }

    if (sched.almocoSaida && sched.almocoVolta && marc.length >= 4) {
      const realDur = toMin(marc[2]) - toMin(marc[1])
      const expDur = toMin(sched.almocoVolta) - toMin(sched.almocoSaida)
      if (Math.abs(realDur - expDur) > tolerancia) {
        out.push({
          data,
          tipo: "INTERVALO",
          detalhe: `Almoço previsto ${expDur}min, real ${realDur}min`,
          marcacoes: marc,
        })
      }
    }
  }

  return tiposAtivos ? out.filter((o) => tiposAtivos.has(o.tipo)) : out
}
