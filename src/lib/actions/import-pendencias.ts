"use server"

import { revalidatePath } from "next/cache"

import { actorName, requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import {
  chavePendencia,
  desserializarDias,
  identidadeDaChave,
} from "@/lib/espelho/import"
import { EMPLOYEE_JORNADA_SELECT, hasResolverSchedule } from "@/lib/jornada"
import { reprocessarCompetencia } from "./fechamento"

// Fila de pendências de importação: as linhas do arquivo que o import não conseguiu
// tratar. Resolver aqui aplica as batidas represadas na própria pendência — sem exigir
// o TXT de novo — e recomputa a competência.

type Resultado = { ok: boolean; error?: string; message?: string }

const COMPETENCIA_FECHADA = "Competência fechada — reabra a competência para alterar."

async function competenciaFechada(competencia: string): Promise<boolean> {
  const c = await prisma.espelhoCompetencia.findUnique({ where: { competencia } })
  return c?.status === "FECHADA"
}

// Grava as batidas represadas no espelho do colaborador. Não calcula ocorrências: quem
// faz isso é o reprocessamento, que enxerga a janela acumulada da competência inteira.
async function aplicarBatidas(input: {
  employeeId: string
  competencia: string
  dias: { data: Date; marcacoes: string[] }[]
  descricao: string
  actorUserId: string
  actorName: string
}): Promise<{ ok: boolean; error?: string }> {
  const existente = await prisma.espelhoFechamento.findUnique({
    where: {
      employeeId_competencia: {
        employeeId: input.employeeId,
        competencia: input.competencia,
      },
    },
    select: { id: true, status: true },
  })
  if (existente?.status === "ENCERRADO") {
    return {
      ok: false,
      error: "O espelho deste colaborador já foi encerrado — reabra antes de aplicar.",
    }
  }

  const fechamento =
    existente ??
    (await prisma.espelhoFechamento.create({
      data: {
        employeeId: input.employeeId,
        competencia: input.competencia,
        status: "ABERTO",
      },
      select: { id: true, status: true },
    }))

  await prisma.$transaction([
    ...input.dias.map((d) =>
      prisma.espelhoDiaRaw.upsert({
        where: { fechamentoId_data: { fechamentoId: fechamento.id, data: d.data } },
        create: {
          fechamentoId: fechamento.id,
          data: d.data,
          marcacoes: d.marcacoes.join(" "),
        },
        update: { marcacoes: d.marcacoes.join(" ") },
      })
    ),
    prisma.espelhoEvento.create({
      data: {
        fechamentoId: fechamento.id,
        action: "IMPORTADO",
        description: input.descricao,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
      },
    }),
  ])

  return { ok: true }
}

// Liga a identificação do arquivo a um colaborador do cadastro. O vínculo é permanente:
// vale para os próximos imports, inclusive nas competências seguintes.
export async function vincularPendencia(
  pendenciaId: string,
  employeeId: string
): Promise<Resultado> {
  const user = await requireModuloEdit("PONTO")

  const p = await prisma.espelhoImportPendencia.findUnique({
    where: { id: pendenciaId },
  })
  if (!p) return { ok: false, error: "Pendência não encontrada." }
  if (p.tipo === "SEM_JORNADA") {
    return {
      ok: false,
      error: "Esta pendência já está vinculada — falta cadastrar a jornada.",
    }
  }
  if (await competenciaFechada(p.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: EMPLOYEE_JORNADA_SELECT,
  })
  if (!employee) return { ok: false, error: "Colaborador não encontrado." }

  const identidade = identidadeDaChave(p.chave)
  const ator = { actorUserId: user.id, actorName: actorName(user) }

  await prisma.espelhoVinculo.upsert({
    where: { chave: identidade },
    create: {
      chave: identidade,
      employeeId,
      nomeArquivo: p.nome,
      matricula: p.matricula,
      empresa: p.empresa,
      ...ator,
    },
    update: { employeeId, ...ator },
  })

  // Vinculado, mas sem escala: a detecção não roda. Vira uma pendência de jornada, com
  // as mesmas batidas represadas — a fila continua mostrando o que falta.
  if (!hasResolverSchedule(employee)) {
    const chaveJornada = chavePendencia("SEM_JORNADA", identidade)
    await prisma.$transaction([
      prisma.espelhoImportPendencia.upsert({
        where: {
          competencia_chave: { competencia: p.competencia, chave: chaveJornada },
        },
        create: {
          competencia: p.competencia,
          chave: chaveJornada,
          tipo: "SEM_JORNADA",
          nome: p.nome,
          matricula: p.matricula,
          empresa: p.empresa,
          employeeId,
          dias: p.dias,
          diasCount: p.diasCount,
          fileName: p.fileName,
          status: "ABERTA",
        },
        update: {
          employeeId,
          dias: p.dias,
          diasCount: p.diasCount,
          status: "ABERTA",
          resolvedAt: null,
          actorName: null,
        },
      }),
      prisma.espelhoImportPendencia.update({
        where: { id: p.id },
        data: {
          status: "RESOLVIDA",
          employeeId,
          resolvedAt: new Date(),
          actorName: ator.actorName,
        },
      }),
    ])
    revalidatePath("/rh/ponto")
    return {
      ok: true,
      message: `Vinculado a ${employee.name}. Falta cadastrar a jornada para as batidas entrarem no espelho.`,
    }
  }

  const dias = desserializarDias(p.dias)
  const aplicado = await aplicarBatidas({
    employeeId,
    competencia: p.competencia,
    dias,
    descricao: `Pendência de importação resolvida — ${dias.length} dia(s) do arquivo "${p.fileName}"`,
    ...ator,
  })
  if (!aplicado.ok) return { ok: false, error: aplicado.error }

  await prisma.espelhoImportPendencia.update({
    where: { id: p.id },
    data: {
      status: "RESOLVIDA",
      employeeId,
      resolvedAt: new Date(),
      actorName: ator.actorName,
    },
  })

  await reprocessarCompetencia(p.competencia)
  revalidatePath("/rh/ponto")
  return {
    ok: true,
    message: `${dias.length} dia(s) aplicados ao espelho de ${employee.name}.`,
  }
}

// Pendência de jornada: o colaborador já é conhecido; só faltava a escala.
export async function aplicarPendencia(pendenciaId: string): Promise<Resultado> {
  const user = await requireModuloEdit("PONTO")

  const p = await prisma.espelhoImportPendencia.findUnique({
    where: { id: pendenciaId },
  })
  if (!p) return { ok: false, error: "Pendência não encontrada." }
  if (!p.employeeId) {
    return { ok: false, error: "Pendência sem colaborador — vincule primeiro." }
  }
  if (await competenciaFechada(p.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: p.employeeId },
    select: EMPLOYEE_JORNADA_SELECT,
  })
  if (!employee) return { ok: false, error: "Colaborador não encontrado." }
  if (!hasResolverSchedule(employee)) {
    return {
      ok: false,
      error: `${employee.name} continua sem escala cadastrada — sem ela não há jornada esperada para comparar.`,
    }
  }

  const dias = desserializarDias(p.dias)
  const ator = { actorUserId: user.id, actorName: actorName(user) }
  const aplicado = await aplicarBatidas({
    employeeId: p.employeeId,
    competencia: p.competencia,
    dias,
    descricao: `Pendência de importação resolvida — ${dias.length} dia(s) do arquivo "${p.fileName}"`,
    ...ator,
  })
  if (!aplicado.ok) return { ok: false, error: aplicado.error }

  await prisma.espelhoImportPendencia.update({
    where: { id: p.id },
    data: { status: "RESOLVIDA", resolvedAt: new Date(), actorName: ator.actorName },
  })

  await reprocessarCompetencia(p.competencia)
  revalidatePath("/rh/ponto")
  return {
    ok: true,
    message: `${dias.length} dia(s) aplicados ao espelho de ${employee.name}.`,
  }
}

// Ignorar não apaga: a linha continua registrada com o motivo, e o próximo import não
// volta a cobrar. Serve p/ quem não é do portal (visitante, prestador, matrícula extinta).
export async function ignorarPendencia(
  pendenciaId: string,
  motivo: string
): Promise<Resultado> {
  const user = await requireModuloEdit("PONTO")
  const p = await prisma.espelhoImportPendencia.findUnique({
    where: { id: pendenciaId },
    select: { id: true, competencia: true },
  })
  if (!p) return { ok: false, error: "Pendência não encontrada." }
  if (await competenciaFechada(p.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA }
  }

  await prisma.espelhoImportPendencia.update({
    where: { id: pendenciaId },
    data: {
      status: "IGNORADA",
      motivo: motivo.trim() || null,
      resolvedAt: new Date(),
      actorName: actorName(user),
    },
  })
  revalidatePath("/rh/ponto")
  return { ok: true, message: "Pendência ignorada." }
}

export async function reabrirPendencia(pendenciaId: string): Promise<Resultado> {
  await requireModuloEdit("PONTO")
  const p = await prisma.espelhoImportPendencia.findUnique({
    where: { id: pendenciaId },
    select: { id: true, competencia: true },
  })
  if (!p) return { ok: false, error: "Pendência não encontrada." }
  if (await competenciaFechada(p.competencia)) {
    return { ok: false, error: COMPETENCIA_FECHADA }
  }

  await prisma.espelhoImportPendencia.update({
    where: { id: pendenciaId },
    data: { status: "ABERTA", motivo: null, resolvedAt: null, actorName: null },
  })
  revalidatePath("/rh/ponto")
  return { ok: true, message: "Pendência reaberta." }
}
