"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"

import { actorName, requireModuloEdit } from "@/lib/auth-helpers"
import { competenciaLabel, currentCompetencia } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { buildEmployeeIndex } from "@/lib/employee-match"
import { formatDate } from "@/lib/format"
import { EMPLOYEE_JORNADA_SELECT } from "@/lib/jornada"
import { setSetting } from "@/lib/settings"
import {
  getTolerancia,
  getTiposAtivos,
  TOLERANCIA_KEY,
  TIPOS_ATIVOS_KEY,
  TODOS_TIPOS,
} from "@/lib/espelho/config"
import {
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import {
  analisarPeriodo,
  desserializarDias,
  janelaAcumulada,
  planejarImport,
  recomputarFechamentos,
  serializarDias,
  type OcorrenciaPlanejada,
} from "@/lib/espelho/import"
import { parseQyonEspelho, type EspelhoDia } from "@/lib/espelho/parse-qyon"

const COMPETENCIA_FECHADA_MSG =
  "Competência fechada — reabra a competência para alterar."

function tipoLabel(tipo: string): string {
  return OCORRENCIA_LABEL[tipo as OcorrenciaTipo] ?? tipo
}

type OcorrenciaRow = {
  fechamentoId: string
  data: Date
  tipo: string
  detalhe: string
  marcacoes: string
  justificativaCategoria: string | null
  justificativaObs: string | null
  resolvido: boolean
}

type EventoRow = {
  fechamentoId: string
  action: string
  description: string
  actorUserId: string
  actorName: string
}

function ocorrenciaRow(
  fechamentoId: string,
  o: OcorrenciaPlanejada
): OcorrenciaRow {
  return {
    fechamentoId,
    data: o.data,
    tipo: o.tipo,
    detalhe: o.detalhe,
    marcacoes: o.marcacoes.join(" "),
    justificativaCategoria: o.justificativaCategoria,
    justificativaObs: o.justificativaObs,
    resolvido: o.resolvido,
  }
}

export async function setTolerancia(min: number): Promise<{ ok: boolean }> {
  await requireModuloEdit("PONTO")
  const v = String(Math.max(0, Math.floor(min || 0)))
  await setSetting(TOLERANCIA_KEY, v)
  revalidatePath("/rh/ponto")
  return { ok: true }
}

export async function setTiposAtivos(list: string[]): Promise<{ ok: boolean }> {
  await requireModuloEdit("PONTO")
  const valid = list.filter((t) => TODOS_TIPOS.includes(t))
  await setSetting(TIPOS_ATIVOS_KEY, valid.join(","))
  revalidatePath("/rh/ponto")
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
        pendencias: number
        periodo: string
        // Mesmo conteúdo já importado antes nesta competência: aviso, não bloqueio —
        // reimportar o mesmo período é idempotente.
        duplicado: boolean
      }
    }
  | undefined

function hashArquivo(buf: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(buf)).digest("hex")
}

export async function importarEspelhoFechamento(
  _prev: FechamentoImportState,
  formData: FormData
): Promise<FechamentoImportState> {
  const user = await requireModuloEdit("PONTO")

  const file = formData.get("file")
  const competenciaSelecionada = String(formData.get("competencia") || "")
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione o arquivo TXT do espelho." }
  }

  // Quando presente, grava SOMENTE estas matrículas (curadoria feita no preview dos Espelhos).
  const incluir = new Set(
    String(formData.get("incluirMatriculas") || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
  )

  const buf = await file.arrayBuffer()
  const fileHash = hashArquivo(buf)

  // O relatório "Marcações Agrupadas" traz o ano com 2 dígitos, então o parser precisa
  // de uma competência como palpite para montar as datas. Dia e mês vêm do arquivo — é
  // o que permite conferir depois se o palpite estava certo.
  const palpite = competenciaSelecionada || currentCompetencia()
  let colaboradores
  try {
    colaboradores = parseQyonEspelho(buf, palpite)
  } catch {
    return { status: "error", message: "Não foi possível ler o arquivo." }
  }

  const periodo = analisarPeriodo(colaboradores)
  if (!periodo) {
    return { status: "error", message: "Nenhuma marcação encontrada no arquivo." }
  }
  if (periodo.competencias.length > 1) {
    return {
      status: "error",
      message: `O arquivo atravessa o dia 20 e cobre mais de uma competência (${periodo.competencias
        .map(competenciaLabel)
        .join(" e ")}). Exporte um relatório por competência.`,
    }
  }

  // A competência vem do arquivo, não da tela: subir o TXT do mês errado deixa de ser
  // possível em silêncio.
  const competencia = periodo.competencias[0]
  const periodoLabel = `${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}`
  if (competenciaSelecionada && competenciaSelecionada !== competencia) {
    return {
      status: "error",
      message: `O arquivo cobre ${periodoLabel}, ou seja, a competência ${competenciaLabel(
        competencia
      )} — mas a tela está em ${competenciaLabel(
        competenciaSelecionada
      )}. Troque a competência ou confira o arquivo.`,
    }
  }
  if (await isCompetenciaFechada(competencia)) {
    return { status: "error", message: COMPETENCIA_FECHADA_MSG }
  }

  const [
    employees,
    vinculosRows,
    tolerancia,
    tiposAtivos,
    existingList,
    pendenciasExistentes,
    duplicado,
  ] = await Promise.all([
    prisma.employee.findMany({ select: EMPLOYEE_JORNADA_SELECT }),
    prisma.espelhoVinculo.findMany({ select: { chave: true, employeeId: true } }),
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
    prisma.espelhoImportPendencia.findMany({ where: { competencia } }),
    prisma.espelhoImportLog.findFirst({ where: { competencia, fileHash } }),
  ])

  const index = buildEmployeeIndex(employees)
  const empById = new Map(employees.map((e) => [e.id, e]))
  const vinculos = new Map(
    vinculosRows
      .map((v) => [v.chave, empById.get(v.employeeId)] as const)
      .filter((pair): pair is [string, (typeof employees)[number]] => !!pair[1])
  )

  const plano = planejarImport({
    colaboradores,
    index,
    vinculos,
    existentes: existingList,
    competencia,
    tolerancia,
    tiposAtivos,
    janelaArquivo: { inicio: periodo.inicio, fim: periodo.fim },
    incluir,
  })

  // Cria os fechamentos que ainda não existem, depois resolve todos os ids de uma vez.
  const existingByEmp = new Map(existingList.map((f) => [f.employeeId, f]))
  const missing = plano.procs.filter((p) => !existingByEmp.has(p.emp.id))
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
    where: { competencia, employeeId: { in: plano.procs.map((p) => p.emp.id) } },
    select: { id: true, employeeId: true },
  })
  const idByEmp = new Map(fechs.map((f) => [f.employeeId, f.id]))

  const ids: string[] = []
  const extIds: string[] = []
  const ocorrRows: OcorrenciaRow[] = []
  const diaRows: { fechamentoId: string; data: Date; marcacoes: string }[] = []
  const eventoRows: EventoRow[] = []
  const ator = { actorUserId: user.id, actorName: actorName(user) }

  let ocorrenciasTotal = 0
  for (const p of plano.procs) {
    const fechamentoId = idByEmp.get(p.emp.id)
    if (!fechamentoId) continue
    ids.push(fechamentoId)

    for (const o of p.ocorr) ocorrRows.push(ocorrenciaRow(fechamentoId, o))
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
      ...ator,
    })
  }

  // Quem não veio no arquivo mas teve a janela estendida por ele.
  for (const r of plano.estendidos) {
    extIds.push(r.fechamento.id)
    for (const o of r.ocorr) ocorrRows.push(ocorrenciaRow(r.fechamento.id, o))
    eventoRows.push({
      fechamentoId: r.fechamento.id,
      action: "REPROCESSADO",
      description: `Janela estendida pelo arquivo "${file.name}" — ${r.ocorr.length} ocorrência(s)`,
      ...ator,
    })
  }

  // Fila de pendências: as batidas ficam represadas na pendência até alguém resolver.
  // Quem já foi ignorado continua ignorado — a fila não volta a cobrar sozinha.
  const pendByChave = new Map(pendenciasExistentes.map((p) => [p.chave, p]))
  const pendenciaOps = plano.pendencias.map((p) => {
    const atual = pendByChave.get(p.chave)
    const dias = serializarDias([
      ...(atual ? desserializarDias(atual.dias) : []),
      ...p.dias,
    ])
    const diasCount = desserializarDias(dias).length
    const base = {
      tipo: p.tipo,
      nome: p.nome,
      matricula: p.matricula,
      empresa: p.empresa,
      employeeId: p.employeeId,
      dias,
      diasCount,
      fileName: file.name,
    }
    return prisma.espelhoImportPendencia.upsert({
      where: { competencia_chave: { competencia, chave: p.chave } },
      create: { competencia, chave: p.chave, status: "ABERTA", ...base },
      update:
        atual?.status === "IGNORADA"
          ? base
          : { ...base, status: "ABERTA", resolvedAt: null, actorName: null },
    })
  })

  await prisma.$transaction([
    prisma.espelhoOcorrencia.deleteMany({
      where: { fechamentoId: { in: [...ids, ...extIds] } },
    }),
    // Batidas cruas só são regravadas p/ quem veio no arquivo; os estendidos mantêm as suas.
    prisma.espelhoDiaRaw.deleteMany({ where: { fechamentoId: { in: ids } } }),
    prisma.espelhoOcorrencia.createMany({ data: ocorrRows }),
    prisma.espelhoDiaRaw.createMany({ data: diaRows }),
    prisma.espelhoEvento.createMany({ data: eventoRows }),
    ...pendenciaOps,
    prisma.espelhoImportLog.create({
      data: {
        competencia,
        fileName: file.name,
        fileHash,
        periodoInicio: periodo.inicio,
        periodoFim: periodo.fim,
        // Existe um único ponto de upload desde a unificação em /rh/ponto; os
        // registros antigos guardam ESPELHOS/FECHAMENTO.
        origem: "PONTO",
        ...ator,
        processados: plano.procs.length,
        ocorrencias: ocorrenciasTotal,
        pendencias: plano.pendencias.length,
        semJornada: JSON.stringify(
          plano.pendencias.filter((p) => p.tipo === "SEM_JORNADA").map((p) => p.nome)
        ),
        naoEncontrados: JSON.stringify(
          plano.pendencias
            .filter((p) => p.tipo !== "SEM_JORNADA")
            .map((p) => `${p.nome} (matrícula ${p.matricula || "—"})`)
        ),
        encerradosPulados: plano.encerradosPulados,
      },
    }),
  ])

  const semJornadaNomes = plano.pendencias
    .filter((p) => p.tipo === "SEM_JORNADA")
    .map((p) => p.nome)
  const naoEncontradosNomes = plano.pendencias
    .filter((p) => p.tipo !== "SEM_JORNADA")
    .map((p) => `${p.nome} (matrícula ${p.matricula || "—"})`)

  revalidatePath("/rh/ponto")
  return {
    status: "ok",
    competencia,
    resumo: {
      processados: plano.procs.length,
      ocorrencias: ocorrenciasTotal,
      semJornada: semJornadaNomes.length,
      naoEncontrados: naoEncontradosNomes.length,
      encerradosPulados: plano.encerradosPulados,
      semJornadaNomes,
      naoEncontradosNomes,
      pendencias: plano.pendencias.length,
      periodo: periodoLabel,
      duplicado: !!duplicado,
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
  const user = await requireModuloEdit("PONTO")
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

  const janela = janelaAcumulada(
    competencia,
    fechs.map((f) => f.dias)
  )
  if (!janela) {
    return { ok: true, resumo: { processados: 0, ocorrencias: 0, semDados: fechs.length } }
  }

  const { recalculados, semDados } = recomputarFechamentos({
    fechamentos: fechs,
    competencia,
    tolerancia,
    tiposAtivos,
    janela,
  })

  const ids: string[] = []
  const ocorrRows: OcorrenciaRow[] = []
  const eventoRows: EventoRow[] = []
  const ator = { actorUserId: user.id, actorName: actorName(user) }
  let ocorrenciasTotal = 0

  for (const r of recalculados) {
    ids.push(r.fechamento.id)
    for (const o of r.ocorr) ocorrRows.push(ocorrenciaRow(r.fechamento.id, o))
    ocorrenciasTotal += r.ocorr.length
    eventoRows.push({
      fechamentoId: r.fechamento.id,
      action: "REPROCESSADO",
      description: `Tolerância ${tolerancia}min — ${r.ocorr.length} ocorrência(s)`,
      ...ator,
    })
  }

  await prisma.$transaction([
    prisma.espelhoOcorrencia.deleteMany({ where: { fechamentoId: { in: ids } } }),
    prisma.espelhoOcorrencia.createMany({ data: ocorrRows }),
    prisma.espelhoEvento.createMany({ data: eventoRows }),
  ])

  revalidatePath("/rh/ponto")
  return {
    ok: true,
    resumo: { processados: recalculados.length, ocorrencias: ocorrenciasTotal, semDados },
  }
}

export async function salvarJustificativa(
  ocorrenciaId: string,
  categoria: string | null,
  obs: string | null
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireModuloEdit("PONTO")
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
  revalidatePath(`/rh/ponto/${oc.fechamento.id}`)
  return { ok: true }
}

export async function salvarJustificativaLote(
  ids: string[],
  categoria: string | null,
  obs: string | null
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireModuloEdit("PONTO")
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
  revalidatePath(`/rh/ponto/${first.fechamento.id}`)
  return { ok: true }
}

// Justifica ocorrências que podem vir de espelhos DIFERENTES — é o lote da
// visão por competência, onde 50 faltas do mesmo feriado estão espalhadas por
// 50 colaboradores. Diferente de salvarJustificativaLote, que só olha o
// primeiro fechamento porque nasceu dentro de um espelho só: aqui cada espelho
// precisa ser checado (um encerrado no meio da seleção não pode ser alterado)
// e cada um recebe o seu evento, senão o histórico dos outros fica mudo.
export async function justificarOcorrencias(
  ids: string[],
  categoria: string | null,
  obs: string | null
): Promise<{ ok: boolean; error?: string; count?: number; ignorados?: number }> {
  const user = await requireModuloEdit("PONTO")
  if (ids.length === 0) return { ok: true, count: 0 }

  const ocorrencias = await prisma.espelhoOcorrencia.findMany({
    where: { id: { in: ids } },
    include: {
      fechamento: { select: { id: true, competencia: true, status: true } },
    },
  })
  if (ocorrencias.length === 0) {
    return { ok: false, error: "Ocorrências não encontradas." }
  }

  const competencias = [
    ...new Set(ocorrencias.map((o) => o.fechamento.competencia)),
  ]
  for (const c of competencias) {
    if (await isCompetenciaFechada(c)) {
      return { ok: false, error: COMPETENCIA_FECHADA_MSG }
    }
  }

  // Espelho encerrado fica de fora em vez de derrubar o lote inteiro: quem
  // selecionou 50 linhas não deve perder as 49 boas por causa de uma.
  const permitidas = ocorrencias.filter(
    (o) => o.fechamento.status !== "ENCERRADO"
  )
  const ignorados = ocorrencias.length - permitidas.length
  if (permitidas.length === 0) {
    return {
      ok: false,
      error: "Todos os espelhos selecionados estão encerrados — reabra para editar.",
    }
  }

  const idsPermitidos = permitidas.map((o) => o.id)
  const fechamentoIds = [...new Set(permitidas.map((o) => o.fechamento.id))]
  const porFechamento = new Map<string, number>()
  for (const o of permitidas) {
    porFechamento.set(o.fechamento.id, (porFechamento.get(o.fechamento.id) ?? 0) + 1)
  }

  await prisma.$transaction([
    prisma.espelhoOcorrencia.updateMany({
      where: { id: { in: idsPermitidos } },
      data: {
        justificativaCategoria: categoria || null,
        justificativaObs: obs || null,
        resolvido: !!categoria,
      },
    }),
    prisma.espelhoFechamento.updateMany({
      where: { id: { in: fechamentoIds }, status: "ABERTO" },
      data: { status: "EM_ANALISE" },
    }),
    prisma.espelhoEvento.createMany({
      data: fechamentoIds.map((fid) => ({
        fechamentoId: fid,
        action: "JUSTIFICATIVA_LOTE",
        description: categoria
          ? `${porFechamento.get(fid)} ocorrência(s) → ${categoria} (lote da competência)`
          : `${porFechamento.get(fid)} ocorrência(s) → justificativa removida (lote da competência)`,
        actorUserId: user.id,
        actorName: actorName(user),
      })),
    }),
  ])

  revalidatePath("/rh/ponto")
  for (const fid of fechamentoIds) revalidatePath(`/rh/ponto/${fid}`)
  return { ok: true, count: idsPermitidos.length, ignorados }
}

export async function encerrarFechamento(
  id: string,
  force = false
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  const user = await requireModuloEdit("PONTO")
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
  revalidatePath(`/rh/ponto/${id}`)
  revalidatePath("/rh/ponto")
  return { ok: true }
}

// Encerra em lote todos os espelhos da competência que estão prontos:
// sem ocorrências ou com todas justificadas.
export async function encerrarProntos(
  competencia: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await requireModuloEdit("PONTO")
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
  revalidatePath("/rh/ponto")
  return { ok: true, count: prontos.length }
}

export async function reabrirFechamento(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireModuloEdit("PONTO")
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
  revalidatePath(`/rh/ponto/${id}`)
  revalidatePath("/rh/ponto")
  return { ok: true }
}

export async function excluirFechamento(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireModuloEdit("PONTO")
  const f = await prisma.espelhoFechamento.findUnique({
    where: { id },
    select: { competencia: true },
  })
  if (!f) return { ok: true }
  if (await isCompetenciaFechada(f.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  await prisma.espelhoFechamento.delete({ where: { id } })
  revalidatePath("/rh/ponto")
  return { ok: true }
}

export async function limparCompetencia(
  competencia: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireModuloEdit("PONTO")
  if (await isCompetenciaFechada(competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA_MSG }
  }
  const r = await prisma.espelhoFechamento.deleteMany({ where: { competencia } })
  revalidatePath("/rh/ponto")
  return { ok: true, count: r.count }
}

// Fecha a competência inteira: trava import, justificativas e encerramentos.
export async function fecharCompetencia(
  competencia: string,
  force = false
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  const user = await requireModuloEdit("PONTO")
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
  revalidatePath("/rh/ponto")
  return { ok: true }
}

export async function reabrirCompetencia(
  competencia: string
): Promise<{ ok: boolean }> {
  await requireModuloEdit("PONTO")
  await prisma.espelhoCompetencia.upsert({
    where: { competencia },
    update: { status: "ABERTA", closedAt: null, closedById: null, closedByName: null },
    create: { competencia, status: "ABERTA" },
  })
  revalidatePath("/rh/ponto")
  return { ok: true }
}
