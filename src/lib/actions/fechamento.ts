"use server"

import { revalidatePath } from "next/cache"

import { actorName, requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { buildEmployeeIndex } from "@/lib/employee-match"
import { formatDate } from "@/lib/format"
import {
  buildDayResolver,
  hasResolverSchedule,
  EMPLOYEE_JORNADA_SELECT,
} from "@/lib/jornada"
import { setSetting } from "@/lib/settings"
import {
  getTolerancia,
  getTiposAtivos,
  TOLERANCIA_KEY,
  TIPOS_ATIVOS_KEY,
  TODOS_TIPOS,
} from "@/lib/espelho/config"
import {
  detectarOcorrencias,
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import {
  periodoDe,
  parseQyonEspelho,
  type EspelhoDia,
} from "@/lib/espelho/parse-qyon"
import { aplicarVirada } from "@/lib/espelho/virada"
import { competenciaRange } from "@/lib/competencia"

const COMPETENCIA_FECHADA_MSG =
  "Competência fechada — reabra a competência para alterar."

function tipoLabel(tipo: string): string {
  return OCORRENCIA_LABEL[tipo as OcorrenciaTipo] ?? tipo
}

export async function setTolerancia(min: number): Promise<{ ok: boolean }> {
  await requireSectorEdit("rh")
  const v = String(Math.max(0, Math.floor(min || 0)))
  await setSetting(TOLERANCIA_KEY, v)
  revalidatePath("/rh/fechamento")
  return { ok: true }
}

export async function setTiposAtivos(list: string[]): Promise<{ ok: boolean }> {
  await requireSectorEdit("rh")
  const valid = list.filter((t) => TODOS_TIPOS.includes(t))
  await setSetting(TIPOS_ATIVOS_KEY, valid.join(","))
  revalidatePath("/rh/fechamento")
  return { ok: true }
}

async function isCompetenciaFechada(competencia: string): Promise<boolean> {
  const c = await prisma.espelhoCompetencia.findUnique({
    where: { competencia },
  })
  return c?.status === "FECHADA"
}

export type FechamentoImportState =
  | {
      status: "ok" | "error"
      message?: string
      competencia?: string
      resumo?: {
        processados: number
        ocorrencias: number
        semJornada: number
        naoEncontrados: number
        encerradosPulados: number
        semJornadaNomes: string[]
        naoEncontradosNomes: string[]
      }
    }
  | undefined

type CarryMap = Map<
  string,
  { cat: string | null; obs: string | null; resolvido: boolean }
>

function carryKey(data: Date, tipo: string): string {
  return `${data.toISOString()}|${tipo}`
}

function buildCarry(
  ocorrencias: {
    data: Date
    tipo: string
    justificativaCategoria: string | null
    justificativaObs: string | null
    resolvido: boolean
  }[]
): CarryMap {
  const map: CarryMap = new Map()
  for (const o of ocorrencias) {
    map.set(carryKey(o.data, o.tipo), {
      cat: o.justificativaCategoria,
      obs: o.justificativaObs,
      resolvido: o.resolvido,
    })
  }
  return map
}

export async function importarEspelhoFechamento(
  _prev: FechamentoImportState,
  formData: FormData
): Promise<FechamentoImportState> {
  const user = await requireSectorEdit("rh")

  const file = formData.get("file")
  const competencia = String(formData.get("competencia") || "")
  const origem =
    String(formData.get("origem") || "") === "ESPELHOS" ? "ESPELHOS" : "FECHAMENTO"
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione o arquivo TXT do espelho." }
  }
  if (!competencia) {
    return { status: "error", message: "Selecione a competência." }
  }
  if (await isCompetenciaFechada(competencia)) {
    return { status: "error", message: COMPETENCIA_FECHADA_MSG }
  }

  // Quando presente, grava SOMENTE estas matrículas (curadoria feita no preview dos Espelhos).
  const incluir = new Set(
    String(formData.get("incluirMatriculas") || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
  )

  let colaboradores
  try {
    colaboradores = parseQyonEspelho(await file.arrayBuffer(), competencia)
  } catch {
    return { status: "error", message: "Não foi possível ler o arquivo." }
  }

  // Janela coberta pelo arquivo (acompanhamento diário com relatórios parciais).
  const janelaArq = periodoDe(colaboradores)
  if (!janelaArq) {
    return { status: "error", message: "Nenhuma marcação encontrada no arquivo." }
  }

  const employees = await prisma.employee.findMany({
    select: EMPLOYEE_JORNADA_SELECT,
  })
  const index = buildEmployeeIndex(employees)

  const [tolerancia, tiposAtivos, existingList] = await Promise.all([
    getTolerancia(),
    getTiposAtivos(),
    prisma.espelhoFechamento.findMany({
      where: { competencia },
      include: {
        ocorrencias: true,
        dias: true,
        employee: { select: EMPLOYEE_JORNADA_SELECT },
      },
    }),
  ])
  const existingByEmp = new Map(existingList.map((f) => [f.employeeId, f]))

  const rawToDias = (rows: { data: Date; marcacoes: string }[]): EspelhoDia[] =>
    rows.map((d) => ({
      data: d.data,
      marcacoes: d.marcacoes.split(" ").filter(Boolean),
    }))

  const naoEncontradosNomes: string[] = []
  const semJornadaNomes: string[] = []
  let encerradosPulados = 0

  type Proc = {
    emp: (typeof employees)[number]
    carry: CarryMap
    ocorr: ReturnType<typeof detectarOcorrencias>
    merged: EspelhoDia[] // batidas acumuladas (existentes fora da janela do arquivo + arquivo)
  }
  const procs: Proc[] = []

  // 1ª passada: mescla as batidas do arquivo com as já gravadas (import incremental —
  // arquivo 30→04 soma ao 21→29 importado antes; dentro da janela, o arquivo novo vence).
  for (const c of colaboradores) {
    const mat = c.matricula.trim()
    if (
      incluir.size > 0 &&
      !incluir.has(mat) &&
      !incluir.has(mat.replace(/^0+/, ""))
    ) {
      continue
    }

    const emp = index.find(mat, c.nome)

    if (!emp) {
      naoEncontradosNomes.push(`${c.nome} (matrícula ${c.matricula || "—"})`)
      continue
    }
    if (!hasResolverSchedule(emp)) {
      semJornadaNomes.push(emp.name)
      continue
    }

    const existing = existingByEmp.get(emp.id)
    if (existing?.status === "ENCERRADO") {
      encerradosPulados++
      continue
    }

    const foraJanela = existing
      ? rawToDias(existing.dias).filter(
          (d) =>
            d.data.getTime() < janelaArq.inicio.getTime() ||
            d.data.getTime() > janelaArq.fim.getTime()
        )
      : []
    const merged = [...foraJanela, ...c.dias]

    procs.push({
      emp,
      carry: existing ? buildCarry(existing.ocorrencias) : new Map(),
      ocorr: [],
      merged,
    })
  }

  // Janela acumulada global da competência: tudo que já foi importado (qualquer
  // fechamento) + o arquivo atual. Limita a detecção nas duas pontas.
  let inicioAcum = janelaArq.inicio
  let fimAcum = janelaArq.fim
  const considerar = (d: Date) => {
    if (d.getTime() < inicioAcum.getTime()) inicioAcum = d
    if (d.getTime() > fimAcum.getTime()) fimAcum = d
  }
  for (const p of procs) for (const d of p.merged) considerar(d.data)
  for (const f of existingList) for (const d of f.dias) considerar(d.data)

  const rangeStart = competenciaRange(competencia).start
  const inicioEfetivo =
    inicioAcum.getTime() > rangeStart.getTime() ? inicioAcum : rangeStart

  // 2ª passada: virada + detecção sobre o acumulado.
  for (const p of procs) {
    const resolver = buildDayResolver(p.emp)
    const dias = aplicarVirada(p.merged, resolver, inicioEfetivo)
    p.ocorr = detectarOcorrencias(
      dias,
      resolver,
      tolerancia,
      competencia,
      tiposAtivos,
      undefined,
      fimAcum,
      inicioEfetivo
    )
  }

  // Cria os fechamentos que ainda não existem, depois resolve todos os ids de uma vez.
  const missing = procs.filter((p) => !existingByEmp.has(p.emp.id))
  if (missing.length > 0) {
    await prisma.espelhoFechamento.createMany({
      data: missing.map((p) => ({
        employeeId: p.emp.id,
        competencia,
        status: "ABERTO",
      })),
    })
  }
  const fechs = await prisma.espelhoFechamento.findMany({
    where: { competencia, employeeId: { in: procs.map((p) => p.emp.id) } },
    select: { id: true, employeeId: true },
  })
  const idByEmp = new Map(fechs.map((f) => [f.employeeId, f.id]))

  const ids: string[] = []
  const ocorrRows: {
    fechamentoId: string
    data: Date
    tipo: string
    detalhe: string
    marcacoes: string
    justificativaCategoria: string | null
    justificativaObs: string | null
    resolvido: boolean
  }[] = []
  const diaRows: { fechamentoId: string; data: Date; marcacoes: string }[] = []
  const eventoRows: {
    fechamentoId: string
    action: string
    description: string
    actorUserId: string
    actorName: string
  }[] = []

  let ocorrenciasTotal = 0
  for (const p of procs) {
    const fechamentoId = idByEmp.get(p.emp.id)
    if (!fechamentoId) continue
    ids.push(fechamentoId)

    for (const o of p.ocorr) {
      const carried = p.carry.get(carryKey(o.data, o.tipo))
      ocorrRows.push({
        fechamentoId,
        data: o.data,
        tipo: o.tipo,
        detalhe: o.detalhe,
        marcacoes: o.marcacoes.join(" "),
        justificativaCategoria: carried?.cat ?? null,
        justificativaObs: carried?.obs ?? null,
        resolvido: carried?.resolvido ?? false,
      })
    }
    ocorrenciasTotal += p.ocorr.length

    // Batidas cruas acumuladas: fonte da verdade p/ reprocessar e p/ próximos merges
    // (dedupe por dia; em duplicata, a última linha vence).
    const byDay = new Map<string, EspelhoDia>()
    for (const d of p.merged) byDay.set(d.data.toISOString(), d)
    for (const d of byDay.values()) {
      diaRows.push({
        fechamentoId,
        data: d.data,
        marcacoes: d.marcacoes.join(" "),
      })
    }

    eventoRows.push({
      fechamentoId,
      action: "IMPORTADO",
      description: `Arquivo "${file.name}" — ${p.ocorr.length} ocorrência(s)`,
      actorUserId: user.id,
      actorName: actorName(user),
    })
  }

  // Fechamentos da competência que NÃO vieram no arquivo (colaborador sem batida no
  // período novo — o relatório só lista quem bateu): a janela acumulada cresceu, então
  // a detecção precisa rodar de novo p/ eles (faltas do período novo aparecem).
  const processedEmp = new Set(procs.map((p) => p.emp.id))
  const extIds: string[] = []
  for (const f of existingList) {
    if (
      processedEmp.has(f.employeeId) ||
      f.status === "ENCERRADO" ||
      f.dias.length === 0 ||
      !hasResolverSchedule(f.employee)
    ) {
      continue
    }
    const resolver = buildDayResolver(f.employee)
    const dias = aplicarVirada(rawToDias(f.dias), resolver, inicioEfetivo)
    const ocorr = detectarOcorrencias(
      dias,
      resolver,
      tolerancia,
      competencia,
      tiposAtivos,
      undefined,
      fimAcum,
      inicioEfetivo
    )
    const carry = buildCarry(f.ocorrencias)
    extIds.push(f.id)
    for (const o of ocorr) {
      const carried = carry.get(carryKey(o.data, o.tipo))
      ocorrRows.push({
        fechamentoId: f.id,
        data: o.data,
        tipo: o.tipo,
        detalhe: o.detalhe,
        marcacoes: o.marcacoes.join(" "),
        justificativaCategoria: carried?.cat ?? null,
        justificativaObs: carried?.obs ?? null,
        resolvido: carried?.resolvido ?? false,
      })
    }
    eventoRows.push({
      fechamentoId: f.id,
      action: "REPROCESSADO",
      description: `Janela estendida pelo arquivo "${file.name}" — ${ocorr.length} ocorrência(s)`,
      actorUserId: user.id,
      actorName: actorName(user),
    })
  }

  await prisma.$transaction([
    prisma.espelhoOcorrencia.deleteMany({
      where: { fechamentoId: { in: [...ids, ...extIds] } },
    }),
    // Batidas cruas só são regravadas p/ quem veio no arquivo (merged); os estendidos mantêm as suas.
    prisma.espelhoDiaRaw.deleteMany({ where: { fechamentoId: { in: ids } } }),
    prisma.espelhoOcorrencia.createMany({ data: ocorrRows }),
    prisma.espelhoDiaRaw.createMany({ data: diaRows }),
    prisma.espelhoEvento.createMany({ data: eventoRows }),
    prisma.espelhoImportLog.create({
      data: {
        competencia,
        fileName: file.name,
        origem,
        actorUserId: user.id,
        actorName: actorName(user),
        processados: procs.length,
        ocorrencias: ocorrenciasTotal,
        semJornada: JSON.stringify(semJornadaNomes),
        naoEncontrados: JSON.stringify(naoEncontradosNomes),
        encerradosPulados,
      },
    }),
  ])

  revalidatePath("/rh/fechamento")
  return {
    status: "ok",
    competencia,
    resumo: {
      processados: procs.length,
      ocorrencias: ocorrenciasTotal,
      semJornada: semJornadaNomes.length,
      naoEncontrados: naoEncontradosNomes.length,
      encerradosPulados,
      semJornadaNomes,
      naoEncontradosNomes,
    },
  }
}

// Recomputa as ocorrências a partir das batidas cruas gravadas, com a tolerância e os
// tipos ativos atuais. Não precisa do TXT de novo. Espelhos encerrados são pulados.
export async function reprocessarCompetencia(competencia: string): Promise<{
  ok: boolean
  error?: string
  resumo?: { processados: number; ocorrencias: number; semDados: number }
}> {
  const user = await requireSectorEdit("rh")
  if (await isCompetenciaFechada(competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }

  const [tolerancia, tiposAtivos, fechs] = await Promise.all([
    getTolerancia(),
    getTiposAtivos(),
    prisma.espelhoFechamento.findMany({
      where: { competencia, status: { not: "ENCERRADO" } },
      include: {
        dias: true,
        ocorrencias: true,
        employee: { select: EMPLOYEE_JORNADA_SELECT },
      },
    }),
  ])

  let processados = 0
  let ocorrenciasTotal = 0
  let semDados = 0
  const ids: string[] = []
  const ocorrRows: {
    fechamentoId: string
    data: Date
    tipo: string
    detalhe: string
    marcacoes: string
    justificativaCategoria: string | null
    justificativaObs: string | null
    resolvido: boolean
  }[] = []
  const eventoRows: {
    fechamentoId: string
    action: string
    description: string
    actorUserId: string
    actorName: string
  }[] = []

  // Janela = período acumulado das batidas gravadas da competência (global,
  // não por colaborador — quem faltou os últimos dias continua gerando falta).
  let inicioAcum: Date | null = null
  let fimAcum: Date | null = null
  for (const f of fechs) {
    for (const d of f.dias) {
      if (!inicioAcum || d.data.getTime() < inicioAcum.getTime()) inicioAcum = d.data
      if (!fimAcum || d.data.getTime() > fimAcum.getTime()) fimAcum = d.data
    }
  }
  const rangeStart = competenciaRange(competencia).start
  const inicioEfetivo =
    inicioAcum && inicioAcum.getTime() > rangeStart.getTime() ? inicioAcum : rangeStart

  for (const f of fechs) {
    // Importado antes das batidas cruas existirem: sem dados p/ recomputar.
    if (f.dias.length === 0 || !hasResolverSchedule(f.employee)) {
      semDados++
      continue
    }
    const raw: EspelhoDia[] = f.dias.map((d) => ({
      data: d.data,
      marcacoes: d.marcacoes.split(" ").filter(Boolean),
    }))
    const resolver = buildDayResolver(f.employee)
    const dias = aplicarVirada(raw, resolver, inicioEfetivo)
    const ocorr = detectarOcorrencias(
      dias,
      resolver,
      tolerancia,
      competencia,
      tiposAtivos,
      undefined,
      fimAcum,
      inicioEfetivo
    )
    const carry = buildCarry(f.ocorrencias)

    ids.push(f.id)
    for (const o of ocorr) {
      const carried = carry.get(carryKey(o.data, o.tipo))
      ocorrRows.push({
        fechamentoId: f.id,
        data: o.data,
        tipo: o.tipo,
        detalhe: o.detalhe,
        marcacoes: o.marcacoes.join(" "),
        justificativaCategoria: carried?.cat ?? null,
        justificativaObs: carried?.obs ?? null,
        resolvido: carried?.resolvido ?? false,
      })
    }
    eventoRows.push({
      fechamentoId: f.id,
      action: "REPROCESSADO",
      description: `Tolerância ${tolerancia}min — ${ocorr.length} ocorrência(s)`,
      actorUserId: user.id,
      actorName: actorName(user),
    })
    processados++
    ocorrenciasTotal += ocorr.length
  }

  await prisma.$transaction([
    prisma.espelhoOcorrencia.deleteMany({ where: { fechamentoId: { in: ids } } }),
    prisma.espelhoOcorrencia.createMany({ data: ocorrRows }),
    prisma.espelhoEvento.createMany({ data: eventoRows }),
  ])

  revalidatePath("/rh/fechamento")
  return { ok: true, resumo: { processados, ocorrencias: ocorrenciasTotal, semDados } }
}

export async function salvarJustificativa(
  ocorrenciaId: string,
  categoria: string | null,
  obs: string | null
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSectorEdit("rh")
  const oc = await prisma.espelhoOcorrencia.findUnique({
    where: { id: ocorrenciaId },
    include: {
      fechamento: { select: { id: true, competencia: true, status: true } },
    },
  })
  if (!oc) return { ok: false, error: "Ocorrência não encontrada." }
  if (oc.fechamento.status === "ENCERRADO") {
    return { ok: false, error: "Espelho encerrado — reabra para editar." }
  }
  if (await isCompetenciaFechada(oc.fechamento.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }

  await prisma.$transaction([
    prisma.espelhoOcorrencia.update({
      where: { id: ocorrenciaId },
      data: {
        justificativaCategoria: categoria || null,
        justificativaObs: obs || null,
        resolvido: !!categoria,
      },
    }),
    prisma.espelhoFechamento.updateMany({
      where: { id: oc.fechamento.id, status: "ABERTO" },
      data: { status: "EM_ANALISE" },
    }),
    prisma.espelhoEvento.create({
      data: {
        fechamentoId: oc.fechamento.id,
        action: "JUSTIFICATIVA",
        description: categoria
          ? `${formatDate(oc.data)} · ${tipoLabel(oc.tipo)} → ${categoria}`
          : `${formatDate(oc.data)} · ${tipoLabel(oc.tipo)} → justificativa removida`,
        actorUserId: user.id,
        actorName: actorName(user),
      },
    }),
  ])
  revalidatePath(`/rh/fechamento/${oc.fechamento.id}`)
  return { ok: true }
}

export async function salvarJustificativaLote(
  ids: string[],
  categoria: string | null,
  obs: string | null
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSectorEdit("rh")
  if (ids.length === 0) return { ok: true }
  const first = await prisma.espelhoOcorrencia.findFirst({
    where: { id: { in: ids } },
    include: {
      fechamento: { select: { id: true, competencia: true, status: true } },
    },
  })
  if (!first) return { ok: false, error: "Ocorrências não encontradas." }
  if (first.fechamento.status === "ENCERRADO") {
    return { ok: false, error: "Espelho encerrado — reabra para editar." }
  }
  if (await isCompetenciaFechada(first.fechamento.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }

  await prisma.$transaction([
    prisma.espelhoOcorrencia.updateMany({
      where: { id: { in: ids } },
      data: {
        justificativaCategoria: categoria || null,
        justificativaObs: obs || null,
        resolvido: !!categoria,
      },
    }),
    prisma.espelhoFechamento.updateMany({
      where: { id: first.fechamento.id, status: "ABERTO" },
      data: { status: "EM_ANALISE" },
    }),
    prisma.espelhoEvento.create({
      data: {
        fechamentoId: first.fechamento.id,
        action: "JUSTIFICATIVA_LOTE",
        description: categoria
          ? `${ids.length} ocorrência(s) → ${categoria}`
          : `${ids.length} ocorrência(s) → justificativa removida`,
        actorUserId: user.id,
        actorName: actorName(user),
      },
    }),
  ])
  revalidatePath(`/rh/fechamento/${first.fechamento.id}`)
  return { ok: true }
}

export async function encerrarFechamento(
  id: string,
  force = false
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  const user = await requireSectorEdit("rh")
  const f = await prisma.espelhoFechamento.findUnique({
    where: { id },
    include: { ocorrencias: { select: { resolvido: true } } },
  })
  if (!f) return { ok: false, error: "Fechamento não encontrado." }
  if (await isCompetenciaFechada(f.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  const pendentes = f.ocorrencias.filter((o) => !o.resolvido).length
  if (pendentes > 0 && !force) {
    return {
      ok: false,
      needsConfirm: true,
      error: `Ainda há ${pendentes} ocorrência(s) sem justificativa.`,
    }
  }
  await prisma.$transaction([
    prisma.espelhoFechamento.update({
      where: { id },
      data: { status: "ENCERRADO", closedAt: new Date() },
    }),
    prisma.espelhoEvento.create({
      data: {
        fechamentoId: id,
        action: "ENCERRADO",
        description: pendentes > 0 ? `Encerrado com ${pendentes} pendente(s)` : null,
        actorUserId: user.id,
        actorName: actorName(user),
      },
    }),
  ])
  revalidatePath(`/rh/fechamento/${id}`)
  revalidatePath("/rh/fechamento")
  return { ok: true }
}

// Encerra em lote todos os espelhos da competência que estão prontos:
// sem ocorrências ou com todas justificadas.
export async function encerrarProntos(
  competencia: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await requireSectorEdit("rh")
  if (await isCompetenciaFechada(competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  const fechs = await prisma.espelhoFechamento.findMany({
    where: { competencia, status: { not: "ENCERRADO" } },
    include: { ocorrencias: { select: { resolvido: true } } },
  })
  const prontos = fechs.filter((f) => f.ocorrencias.every((o) => o.resolvido))
  if (prontos.length === 0) return { ok: true, count: 0 }

  const now = new Date()
  await prisma.$transaction([
    prisma.espelhoFechamento.updateMany({
      where: { id: { in: prontos.map((f) => f.id) } },
      data: { status: "ENCERRADO", closedAt: now },
    }),
    prisma.espelhoEvento.createMany({
      data: prontos.map((f) => ({
        fechamentoId: f.id,
        action: "ENCERRADO",
        description: "Encerrado em lote",
        actorUserId: user.id,
        actorName: actorName(user),
      })),
    }),
  ])
  revalidatePath("/rh/fechamento")
  return { ok: true, count: prontos.length }
}

export async function reabrirFechamento(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSectorEdit("rh")
  const f = await prisma.espelhoFechamento.findUnique({
    where: { id },
    select: { competencia: true },
  })
  if (!f) return { ok: false, error: "Fechamento não encontrado." }
  if (await isCompetenciaFechada(f.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  await prisma.$transaction([
    prisma.espelhoFechamento.update({
      where: { id },
      data: { status: "EM_ANALISE", closedAt: null },
    }),
    prisma.espelhoEvento.create({
      data: {
        fechamentoId: id,
        action: "REABERTO",
        actorUserId: user.id,
        actorName: actorName(user),
      },
    }),
  ])
  revalidatePath(`/rh/fechamento/${id}`)
  revalidatePath("/rh/fechamento")
  return { ok: true }
}

export async function excluirFechamento(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireSectorEdit("rh")
  const f = await prisma.espelhoFechamento.findUnique({
    where: { id },
    select: { competencia: true },
  })
  if (!f) return { ok: true }
  if (await isCompetenciaFechada(f.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  await prisma.espelhoFechamento.delete({ where: { id } })
  revalidatePath("/rh/fechamento")
  return { ok: true }
}

export async function limparCompetencia(
  competencia: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireSectorEdit("rh")
  if (await isCompetenciaFechada(competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  const r = await prisma.espelhoFechamento.deleteMany({ where: { competencia } })
  revalidatePath("/rh/fechamento")
  return { ok: true, count: r.count }
}

// Fecha a competência inteira: trava import, justificativas e encerramentos.
export async function fecharCompetencia(
  competencia: string,
  force = false
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  const user = await requireSectorEdit("rh")
  const abertos = await prisma.espelhoFechamento.count({
    where: { competencia, status: { not: "ENCERRADO" } },
  })
  if (abertos > 0 && !force) {
    return {
      ok: false,
      needsConfirm: true,
      error: `Ainda há ${abertos} espelho(s) não encerrado(s).`,
    }
  }
  await prisma.espelhoCompetencia.upsert({
    where: { competencia },
    update: {
      status: "FECHADA",
      closedAt: new Date(),
      closedById: user.id,
      closedByName: actorName(user),
    },
    create: {
      competencia,
      status: "FECHADA",
      closedAt: new Date(),
      closedById: user.id,
      closedByName: actorName(user),
    },
  })
  revalidatePath("/rh/fechamento")
  return { ok: true }
}

export async function reabrirCompetencia(
  competencia: string
): Promise<{ ok: boolean }> {
  await requireSectorEdit("rh")
  await prisma.espelhoCompetencia.upsert({
    where: { competencia },
    update: { status: "ABERTA", closedAt: null, closedById: null, closedByName: null },
    create: { competencia, status: "ABERTA" },
  })
  revalidatePath("/rh/fechamento")
  return { ok: true }
}
