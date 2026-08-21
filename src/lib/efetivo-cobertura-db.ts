import { prisma } from "@/lib/db"
import {
  chaveTurno,
  COBERTURA_DIAS,
  diasAte,
  turnosEsperados,
  type EfetivoPeriodo,
} from "@/lib/efetivo-cobertura"

// Consultas de cobertura do efetivo. Sempre agregadas e sempre limitadas a uma
// faixa de dias: nenhuma tela precisa dos registros linha a linha, então nada
// aqui carrega Efetivo inteiro.

export type CoberturaTurno = {
  total: number
  atualizadoEm: Date | null
  confirmadoEm: Date | null
  confirmadoPor: string | null
}

export const TURNO_VAZIO: CoberturaTurno = {
  total: 0,
  atualizadoEm: null,
  confirmadoEm: null,
  confirmadoPor: null,
}

/** deptId → (`chaveTurno(data, periodo)` → contagem/carimbos). */
export type Cobertura = Map<string, Map<string, CoberturaTurno>>

function faixa(dias: string[]): { min: Date; max: Date } | null {
  if (dias.length === 0) return null
  const tempos = dias.map((d) => Date.parse(`${d}T00:00:00.000Z`))
  return { min: new Date(Math.min(...tempos)), max: new Date(Math.max(...tempos)) }
}

const isoDia = (d: Date) => d.toISOString().slice(0, 10)

export async function carregarCobertura(
  dias: string[],
  departmentId?: string
): Promise<Cobertura> {
  const limites = faixa(dias)
  const cobertura: Cobertura = new Map()
  if (!limites) return cobertura

  const where = {
    ...(departmentId ? { departmentId } : {}),
    date: { gte: limites.min, lte: limites.max },
  }

  const [grupos, conferencias] = await Promise.all([
    prisma.efetivo.groupBy({
      by: ["departmentId", "date", "periodo"],
      where,
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.efetivoConferencia.findMany({
      where,
      select: {
        departmentId: true,
        date: true,
        periodo: true,
        confirmadoAt: true,
        actorName: true,
      },
    }),
  ])

  const turno = (deptId: string, chave: string): CoberturaTurno => {
    const doPosto = cobertura.get(deptId) ?? new Map<string, CoberturaTurno>()
    cobertura.set(deptId, doPosto)
    const atual = doPosto.get(chave) ?? { ...TURNO_VAZIO }
    doPosto.set(chave, atual)
    return atual
  }

  for (const g of grupos) {
    const t = turno(g.departmentId, chaveTurno(isoDia(g.date), g.periodo))
    t.total = g._count._all
    t.atualizadoEm = g._max.updatedAt
  }
  for (const c of conferencias) {
    const t = turno(c.departmentId, chaveTurno(isoDia(c.date), c.periodo))
    t.confirmadoEm = c.confirmadoAt
    t.confirmadoPor = c.actorName
  }

  return cobertura
}

export function turnoDe(
  cobertura: Cobertura,
  departmentId: string,
  dateStr: string,
  periodo: string
): CoberturaTurno {
  return (
    cobertura.get(departmentId)?.get(chaveTurno(dateStr, periodo)) ?? TURNO_VAZIO
  )
}

/**
 * Quais turnos cobrar de cada posto, deduzido do histórico recente. Postos sem
 * nenhum movimento na janela de referência ficam fora do mapa — posto inativo
 * não gera alerta.
 */
export async function carregarTurnosEsperados(
  fimStr: string,
  departmentId?: string
): Promise<Map<string, EfetivoPeriodo[]>> {
  const dias = diasAte(fimStr, COBERTURA_DIAS)
  const limites = faixa(dias)
  const esperados = new Map<string, EfetivoPeriodo[]>()
  if (!limites) return esperados

  const grupos = await prisma.efetivo.groupBy({
    by: ["departmentId", "date", "periodo"],
    where: {
      ...(departmentId ? { departmentId } : {}),
      date: { gte: limites.min, lte: limites.max },
    },
  })

  const porPosto = new Map<string, { date: string; periodo: string }[]>()
  for (const g of grupos) {
    const lista = porPosto.get(g.departmentId) ?? []
    lista.push({ date: isoDia(g.date), periodo: g.periodo })
    porPosto.set(g.departmentId, lista)
  }

  for (const [deptId, registros] of porPosto) {
    const turnos = turnosEsperados(registros, dias.length)
    if (turnos.length > 0) esperados.set(deptId, turnos)
  }
  return esperados
}
