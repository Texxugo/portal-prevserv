import { prisma } from "@/lib/db"
import { enderecoResumo } from "@/lib/geo/endereco"
import { buildDayResolver } from "@/lib/jornada"
import {
  situacaoDoDia,
  temRegistroSanto,
  type Situacao,
} from "@/lib/painel/situacao"
import {
  filtroDepartmentId,
  filtroPostoId,
  postosPermitidos,
  type Access,
} from "@/lib/permissions"

// Carga do painel operacional: tudo o que o mapa e a lista lateral precisam de
// um dia só, em quatro consultas. O escopo de posto do usuário entra em todas
// elas — quem não enxerga o posto não recebe nem o alfinete nem a vaga.

export type PostoPainel = {
  id: string
  nome: string
  lat: number | null
  lng: number | null
  endereco: string
  cidade: string | null
  geocodeStatus: string | null
  efetivoDiurno: number
  efetivoNoturno: number
  vagas: VagaPainel[]
}

export type VagaPainel = {
  id: string
  departmentId: string
  postoNome: string
  periodo: string
  horario: string | null
  motivo: string
  observacao: string | null
  ausenteNome: string | null
  status: string
  cobertaPorNome: string | null
  criadaPor: string
  criadaEm: string
  convites: ConvitePainel[]
}

export type ConvitePainel = {
  id: string
  vagaId: string
  employeeId: string
  employeeNome: string
  status: string
  etapa: string
  precisaDeslocamento: boolean | null
  distanciaKm: number | null
  enviadoEm: string
  respondidoEm: string | null
  respostaTexto: string | null
  erro: string | null
}

export type ColaboradorPainel = {
  id: string
  nome: string
  empresa: string | null
  santo: boolean
  sexo: string | null
  phone: string | null
  optOut: boolean
  departmentId: string | null
  departmentNome: string | null
  lat: number | null
  lng: number | null
  endereco: string
  cidade: string | null
  situacao: Situacao
  escalaNome: string | null
}

export type SugestaoBaixa = {
  movementId: string
  employeeId: string
  employeeNome: string
  departmentId: string
  postoNome: string
  tipo: string // FALTA | FERIAS
  justificada: boolean | null
  inicio: string
  fim: string | null
}

export type PainelDados = {
  data: string
  postos: PostoPainel[]
  colaboradores: ColaboradorPainel[]
  sugestoes: SugestaoBaixa[]
}

/** Dia em UTC-midnight, igual ao resto do sistema (ver schemas.requiredDate). */
function diaUtc(dataStr: string): Date {
  return new Date(`${dataStr}T00:00:00.000Z`)
}

const MOTIVO_POR_MOVIMENTO: Record<string, string> = {
  FALTA: "FALTA",
  FERIAS: "FERIAS",
}

export async function carregarPainel(
  access: Access,
  dataStr: string
): Promise<PainelDados> {
  const dia = diaUtc(dataStr)
  const escopoPosto = filtroPostoId(access)
  const escopoDepartamento = filtroDepartmentId(access)

  // O painel também mostra quem não tem posto (departmentId null): é gente sem
  // alocação fixa, exatamente o perfil que sobra para cobrir extra.
  //
  // O OR precisa ser montado à parte: `filtroDepartmentId` devolve `{}` para
  // quem enxerga tudo, e um objeto vazio DENTRO de um OR do Prisma não casa
  // nada — quem via todos os postos acabava vendo menos gente que um usuário
  // restrito a um posto só.
  const idsPermitidos = postosPermitidos(access)
  const escopoColaborador =
    idsPermitidos === null
      ? {}
      : { OR: [{ departmentId: null }, { departmentId: { in: idsPermitidos } }] }

  const [postosRaw, colaboradoresRaw, efetivos, vagasRaw] = await Promise.all([
    prisma.department.findMany({
      where: escopoPosto,
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, lat: true, lng: true, geocodeStatus: true,
        logradouro: true, numero: true, bairro: true, cidade: true, uf: true,
      },
    }),
    prisma.employee.findMany({
      where: { status: { in: ["ATIVO", "AFASTADO"] }, ...escopoColaborador },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, empresa: true, sexo: true, phone: true,
        whatsappOptOut: true, status: true, departmentId: true,
        lat: true, lng: true, endereco: true,
        logradouro: true, numero: true, bairro: true, cidade: true, uf: true,
        escalaInicio: true,
        escala: { select: { name: true, cycleDays: true } },
        department: { select: { name: true } },
        movements: {
          where: {
            type: { in: ["FALTA", "FERIAS"] },
            startDate: { lte: dia },
            OR: [{ endDate: null }, { endDate: { gte: dia } }],
          },
          select: { id: true, type: true, justificada: true, startDate: true, endDate: true },
        },
        efetivos: {
          where: { date: dia },
          select: { departmentId: true, periodo: true },
        },
      },
    }),
    prisma.efetivo.groupBy({
      by: ["departmentId", "periodo"],
      where: { date: dia, ...escopoDepartamento },
      _count: { _all: true },
    }),
    prisma.coberturaVaga.findMany({
      where: { date: dia, status: { not: "CANCELADA" }, ...escopoDepartamento },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true, departmentId: true, periodo: true, horario: true,
        motivo: true, observacao: true, status: true, criadaPor: true,
        createdAt: true,
        department: { select: { name: true } },
        ausente: { select: { name: true } },
        cobertaPor: { select: { name: true } },
        convites: {
          orderBy: { enviadoAt: "desc" },
          select: {
            id: true, vagaId: true, employeeId: true, status: true, etapa: true,
            precisaDeslocamento: true, distanciaKm: true, enviadoAt: true,
            respondidoAt: true, respostaTexto: true, erro: true,
            employee: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const vagasPorPosto = new Map<string, VagaPainel[]>()
  for (const v of vagasRaw) {
    const vaga: VagaPainel = {
      id: v.id,
      departmentId: v.departmentId,
      postoNome: v.department.name,
      periodo: v.periodo,
      horario: v.horario,
      motivo: v.motivo,
      observacao: v.observacao,
      ausenteNome: v.ausente?.name ?? null,
      status: v.status,
      cobertaPorNome: v.cobertaPor?.name ?? null,
      criadaPor: v.criadaPor,
      criadaEm: v.createdAt.toISOString(),
      convites: v.convites.map((c) => ({
        id: c.id,
        vagaId: c.vagaId,
        employeeId: c.employeeId,
        employeeNome: c.employee.name,
        status: c.status,
        etapa: c.etapa,
        precisaDeslocamento: c.precisaDeslocamento,
        distanciaKm: c.distanciaKm,
        enviadoEm: c.enviadoAt.toISOString(),
        respondidoEm: c.respondidoAt?.toISOString() ?? null,
        respostaTexto: c.respostaTexto,
        erro: c.erro,
      })),
    }
    const lista = vagasPorPosto.get(v.departmentId)
    if (lista) lista.push(vaga)
    else vagasPorPosto.set(v.departmentId, [vaga])
  }

  const efetivoPorPosto = new Map<string, { DIURNO: number; NOTURNO: number }>()
  for (const g of efetivos) {
    const atual = efetivoPorPosto.get(g.departmentId) ?? { DIURNO: 0, NOTURNO: 0 }
    if (g.periodo === "NOTURNO") atual.NOTURNO += g._count._all
    else atual.DIURNO += g._count._all
    efetivoPorPosto.set(g.departmentId, atual)
  }

  const postos: PostoPainel[] = postosRaw.map((p) => {
    const efetivo = efetivoPorPosto.get(p.id) ?? { DIURNO: 0, NOTURNO: 0 }
    return {
      id: p.id,
      nome: p.name,
      lat: p.lat,
      lng: p.lng,
      endereco: enderecoResumo(p),
      cidade: p.cidade,
      geocodeStatus: p.geocodeStatus,
      efetivoDiurno: efetivo.DIURNO,
      efetivoNoturno: efetivo.NOTURNO,
      vagas: vagasPorPosto.get(p.id) ?? [],
    }
  })

  const colaboradores: ColaboradorPainel[] = colaboradoresRaw.map((e) => {
    const resolver = buildDayResolver(e)
    const temEscala = !!(e.escala && e.escalaInicio)
    const situacao = situacaoDoDia({
      status: e.status,
      noEfetivoHoje: e.efetivos.length > 0,
      temMovimentoAfastando: e.movements.length > 0,
      temEscala,
      escaladoHoje: temEscala && resolver(dia) !== null,
    })
    return {
      id: e.id,
      nome: e.name,
      empresa: e.empresa,
      santo: temRegistroSanto(e.empresa),
      sexo: e.sexo,
      phone: e.phone,
      optOut: e.whatsappOptOut,
      departmentId: e.departmentId,
      departmentNome: e.department?.name ?? null,
      lat: e.lat,
      lng: e.lng,
      endereco: enderecoResumo(e) || (e.endereco ?? ""),
      cidade: e.cidade,
      situacao,
      escalaNome: e.escala?.name ?? null,
    }
  })

  return {
    data: dataStr,
    postos,
    colaboradores,
    sugestoes: await sugestoesDeBaixa(access, dia),
  }
}

/**
 * Baixas prováveis do dia: falta ou férias de alguém que tem posto, sem vaga
 * já criada para aquela ausência. É sugestão — nada entra no mapa antes de
 * alguém confirmar, justamente porque nem toda ausência exige reposição.
 */
export async function sugestoesDeBaixa(
  access: Access,
  dia: Date
): Promise<SugestaoBaixa[]> {
  const movimentos = await prisma.movement.findMany({
    where: {
      type: { in: ["FALTA", "FERIAS"] },
      startDate: { lte: dia },
      OR: [{ endDate: null }, { endDate: { gte: dia } }],
      employee: {
        status: "ATIVO",
        departmentId: { not: null },
        ...filtroDepartmentId(access),
      },
    },
    select: {
      id: true, type: true, justificada: true, startDate: true, endDate: true,
      employee: {
        select: {
          id: true, name: true, departmentId: true,
          department: { select: { name: true } },
        },
      },
    },
  })
  if (movimentos.length === 0) return []

  const jaViraramVaga = new Set(
    (
      await prisma.coberturaVaga.findMany({
        where: {
          date: dia,
          origemMovementId: { in: movimentos.map((m) => m.id) },
        },
        select: { origemMovementId: true },
      })
    ).map((v) => v.origemMovementId)
  )

  return movimentos
    .filter((m) => !jaViraramVaga.has(m.id) && m.employee.departmentId)
    .map((m) => ({
      movementId: m.id,
      employeeId: m.employee.id,
      employeeNome: m.employee.name,
      departmentId: m.employee.departmentId as string,
      postoNome: m.employee.department?.name ?? "—",
      tipo: MOTIVO_POR_MOVIMENTO[m.type] ?? "OUTRO",
      justificada: m.justificada,
      inicio: m.startDate.toISOString().slice(0, 10),
      fim: m.endDate?.toISOString().slice(0, 10) ?? null,
    }))
}
