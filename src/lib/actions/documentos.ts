"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

import { actorName, requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { isDocumentoAberto } from "@/lib/documentos"
import { firstError } from "@/lib/form"
import { corrigirMensagem } from "@/lib/gemini"
import {
  documentoCancelamentoSchema,
  documentoPendenciaSchema,
  documentoPendenciaUpdateSchema,
  documentoReaberturaSchema,
  documentoRecebimentoSchema,
  documentoSolicitacaoSchema,
  documentoTipoSchema,
} from "@/lib/schemas"
import { sendAndLogWhatsapp } from "@/lib/whatsapp/send"

type Result = { ok: boolean; error?: string; id?: string }

function historyData(
  user: { id: string; name?: string | null; email?: string | null },
  action: string,
  description?: string,
  metadata?: unknown
) {
  return {
    action,
    description: description || null,
    actorUserId: user.id,
    actorName: actorName(user),
    metadata: metadata === undefined ? null : JSON.stringify(metadata),
  }
}

function refresh(id?: string, fechamentoId?: string) {
  revalidatePath("/rh/pendencias")
  revalidatePath("/")
  if (fechamentoId) revalidatePath(`/rh/fechamento/${fechamentoId}`)
}

export async function createDocumentoPendencia(input: {
  employeeId: string
  competencia: string
  documentTypeId: string
  occurrenceId?: string | null
  reason: string
  notes?: string | null
  followUpDate: string
  alreadyRequested?: boolean
}): Promise<Result> {
  const user = await requireSectorEdit("rh")
  const parsed = documentoPendenciaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const type = await prisma.documentoTipo.findFirst({
    where: { id: parsed.data.documentTypeId, active: true },
  })
  if (!type) return { ok: false, error: "Tipo de documento indisponível." }

  let employeeId = parsed.data.employeeId
  let competencia = parsed.data.competencia
  let employeeName = ""
  let matricula: string | null = null
  let occurrenceId: string | null = null
  let sourceDate: Date | null = null
  let sourceType: string | null = null
  let sourceDetail: string | null = null
  let fechamentoId: string | undefined

  if (parsed.data.occurrenceId) {
    const occurrence = await prisma.espelhoOcorrencia.findUnique({
      where: { id: parsed.data.occurrenceId },
      include: {
        fechamento: {
          include: { employee: { select: { id: true, name: true, matricula: true } } },
        },
      },
    })
    if (!occurrence) return { ok: false, error: "Ocorrência não encontrada." }
    if (!occurrence.resolvido) {
      return { ok: false, error: "Salve a justificativa antes de solicitar o documento." }
    }
    const duplicate = await prisma.documentoPendencia.findFirst({
      where: {
        occurrenceId: occurrence.id,
        documentTypeId: type.id,
        status: { in: ["PENDENTE", "SOLICITADO"] },
      },
    })
    if (duplicate) {
      return { ok: false, error: "Já existe uma pendência aberta deste tipo para a ocorrência." }
    }
    employeeId = occurrence.fechamento.employee.id
    competencia = occurrence.fechamento.competencia
    employeeName = occurrence.fechamento.employee.name
    matricula = occurrence.fechamento.employee.matricula
    occurrenceId = occurrence.id
    sourceDate = occurrence.data
    sourceType = occurrence.tipo
    sourceDetail = occurrence.detalhe
    fechamentoId = occurrence.fechamentoId
  } else {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, matricula: true },
    })
    if (!employee) return { ok: false, error: "Colaborador não encontrado." }
    const duplicate = await prisma.documentoPendencia.findFirst({
      where: {
        employeeId,
        documentTypeId: type.id,
        competencia,
        status: { in: ["PENDENTE", "SOLICITADO"] },
      },
    })
    if (duplicate) {
      return {
        ok: false,
        error:
          "Já existe pendência aberta deste tipo para este colaborador nesta competência.",
      }
    }
    employeeName = employee.name
    matricula = employee.matricula
  }

  const alreadyRequested = parsed.data.alreadyRequested === true
  const created = await prisma.documentoPendencia.create({
    data: {
      employeeId,
      employeeName,
      matricula,
      competencia,
      documentTypeId: type.id,
      occurrenceId,
      sourceDate,
      sourceType,
      sourceDetail,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      followUpDate: parsed.data.followUpDate,
      status: alreadyRequested ? "SOLICITADO" : "PENDENTE",
      requestedAt: alreadyRequested ? new Date() : null,
      createdById: user.id,
      createdByName: actorName(user),
      history: {
        create: historyData(
          user,
          "CRIADA",
          alreadyRequested
            ? `Pendência criada (já solicitada): ${type.name}`
            : `Pendência criada: ${type.name}`
        ),
      },
    },
  })

  refresh(created.id, fechamentoId)
  return { ok: true, id: created.id }
}

export async function updateDocumentoPendencia(
  id: string,
  input: {
    documentTypeId: string
    reason: string
    notes?: string | null
    followUpDate: string
  }
): Promise<Result> {
  const user = await requireSectorEdit("rh")
  const parsed = documentoPendenciaUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const current = await prisma.documentoPendencia.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Pendência não encontrada." }
  if (!isDocumentoAberto(current.status)) {
    return { ok: false, error: "Reabra a pendência antes de editar." }
  }
  const type = await prisma.documentoTipo.findFirst({
    where: {
      id: parsed.data.documentTypeId,
      OR: [{ active: true }, { id: current.documentTypeId }],
    },
  })
  if (!type) return { ok: false, error: "Tipo de documento indisponível." }
  if (current.occurrenceId && current.documentTypeId !== type.id) {
    const duplicate = await prisma.documentoPendencia.findFirst({
      where: {
        id: { not: id },
        occurrenceId: current.occurrenceId,
        documentTypeId: type.id,
        status: { in: ["PENDENTE", "SOLICITADO"] },
      },
    })
    if (duplicate) {
      return { ok: false, error: "Já existe uma pendência aberta deste tipo para a ocorrência." }
    }
  }

  const changedDate = current.followUpDate.getTime() !== parsed.data.followUpDate.getTime()
  await prisma.$transaction([
    prisma.documentoPendencia.update({
      where: { id },
      data: {
        documentTypeId: type.id,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
        followUpDate: parsed.data.followUpDate,
      },
    }),
    prisma.documentoPendenciaHistorico.create({
      data: {
        ...historyData(
          user,
          changedDate ? "PRAZO_ALTERADO" : "ATUALIZADA",
          changedDate
            ? "Dados e data de retorno atualizados."
            : "Dados da pendência atualizados."
        ),
        pendenciaId: id,
      },
    }),
  ])

  refresh(id)
  return { ok: true }
}

export async function solicitarDocumento(
  id: string,
  input: { message: string; followUpDate: string }
): Promise<Result> {
  const user = await requireSectorEdit("rh")
  const parsed = documentoSolicitacaoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const pending = await prisma.documentoPendencia.findUnique({
    where: { id },
    include: { employee: { select: { phone: true } } },
  })
  if (!pending) return { ok: false, error: "Pendência não encontrada." }
  if (!isDocumentoAberto(pending.status)) {
    return { ok: false, error: "Esta pendência não está aberta para solicitação." }
  }

  const result = await sendAndLogWhatsapp(
    {
      employeeId: pending.employeeId,
      matricula: pending.matricula,
      employeeName: pending.employeeName,
      phone: pending.employee?.phone ?? null,
      competencia: pending.competencia,
    },
    parsed.data.message
  )

  await prisma.$transaction(async (tx) => {
    if (result.ok) {
      await tx.documentoPendencia.update({
        where: { id },
        data: {
          status: "SOLICITADO",
          requestedAt: new Date(),
          followUpDate: parsed.data.followUpDate,
        },
      })
    }
    await tx.documentoPendenciaHistorico.create({
      data: {
        ...historyData(
          user,
          result.ok ? "SOLICITACAO_ENVIADA" : "SOLICITACAO_ERRO",
          result.ok ? "Solicitação enviada pelo WhatsApp." : `Falha no WhatsApp: ${result.error}`,
          { messageId: result.ok ? result.messageId : null, error: result.error ?? null }
        ),
        pendenciaId: id,
      },
    })
  })

  refresh(id)
  return { ok: result.ok, error: result.error }
}

export async function receberDocumento(
  id: string,
  input: { externalUrl: string; notes?: string | null }
): Promise<Result> {
  const user = await requireSectorEdit("rh")
  const parsed = documentoRecebimentoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const current = await prisma.documentoPendencia.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Pendência não encontrada." }
  if (!isDocumentoAberto(current.status)) return { ok: false, error: "Pendência já finalizada." }

  await prisma.$transaction([
    prisma.documentoPendencia.update({
      where: { id },
      data: {
        status: "RECEBIDO",
        externalUrl: parsed.data.externalUrl,
        notes: parsed.data.notes ?? current.notes,
        receivedAt: new Date(),
        canceledAt: null,
      },
    }),
    prisma.documentoPendenciaHistorico.create({
      data: {
        ...historyData(user, "RECEBIDA", "Documento recebido e link registrado.", {
          externalUrl: parsed.data.externalUrl,
        }),
        pendenciaId: id,
      },
    }),
  ])
  refresh(id)
  return { ok: true }
}

export async function cancelarDocumento(id: string, reason: string): Promise<Result> {
  const user = await requireSectorEdit("rh")
  const parsed = documentoCancelamentoSchema.safeParse({ reason })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const current = await prisma.documentoPendencia.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Pendência não encontrada." }
  if (!isDocumentoAberto(current.status)) return { ok: false, error: "Pendência já finalizada." }

  await prisma.$transaction([
    prisma.documentoPendencia.update({
      where: { id },
      data: { status: "CANCELADO", canceledAt: new Date() },
    }),
    prisma.documentoPendenciaHistorico.create({
      data: { ...historyData(user, "CANCELADA", parsed.data.reason), pendenciaId: id },
    }),
  ])
  refresh(id)
  return { ok: true }
}

export async function reabrirDocumento(
  id: string,
  input: { reason: string; followUpDate: string }
): Promise<Result> {
  const user = await requireSectorEdit("rh")
  const parsed = documentoReaberturaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const current = await prisma.documentoPendencia.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Pendência não encontrada." }
  if (isDocumentoAberto(current.status)) return { ok: false, error: "Pendência já está aberta." }

  await prisma.$transaction([
    prisma.documentoPendencia.update({
      where: { id },
      data: {
        status: "PENDENTE",
        followUpDate: parsed.data.followUpDate,
        externalUrl: null,
        requestedAt: null,
        receivedAt: null,
        canceledAt: null,
      },
    }),
    prisma.documentoPendenciaHistorico.create({
      data: {
        ...historyData(user, "REABERTA", parsed.data.reason, {
          previousStatus: current.status,
          previousExternalUrl: current.externalUrl,
        }),
        pendenciaId: id,
      },
    }),
  ])
  refresh(id)
  return { ok: true }
}

export async function corrigirMensagemDocumento(
  text: string
): Promise<{ ok: boolean; text?: string; error?: string }> {
  await requireSectorEdit("rh")
  if (text.trim().length < 5) {
    return { ok: false, error: "Escreva a mensagem antes de corrigir." }
  }
  return corrigirMensagem(text)
}

export async function createDocumentoTipo(name: string): Promise<Result> {
  await requireSectorEdit("rh")
  const parsed = documentoTipoSchema.safeParse({ name })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  try {
    await prisma.documentoTipo.create({ data: parsed.data })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Já existe um tipo com este nome." }
    }
    throw error
  }
  revalidatePath("/rh/pendencias/tipos")
  return { ok: true }
}

export async function updateDocumentoTipo(id: string, name: string): Promise<Result> {
  await requireSectorEdit("rh")
  const parsed = documentoTipoSchema.safeParse({ name })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  try {
    await prisma.documentoTipo.update({ where: { id }, data: parsed.data })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Já existe um tipo com este nome." }
    }
    throw error
  }
  revalidatePath("/rh/pendencias/tipos")
  revalidatePath("/rh/pendencias")
  return { ok: true }
}

export async function setDocumentoTipoActive(id: string, active: boolean): Promise<Result> {
  await requireSectorEdit("rh")
  await prisma.documentoTipo.update({ where: { id }, data: { active } })
  revalidatePath("/rh/pendencias/tipos")
  revalidatePath("/rh/pendencias")
  return { ok: true }
}
