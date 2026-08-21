"use server"

import { revalidatePath } from "next/cache"

import {
  actorName,
  checkPostoEdit,
  requireModuloEdit,
} from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import { enviarConviteExtra } from "@/lib/painel/convite"
import { podeVerPosto } from "@/lib/permissions"
import { coberturaVagaSchema, EFETIVO_EVENTO_SEM_ALTERACAO } from "@/lib/schemas"

// Ações do painel operacional: abrir e fechar baixa, convocar para extra.
// Tudo passa por checkPostoEdit — a baixa é dado de posto, e quem não tem o
// posto no escopo não pode nem abrir nem fechar.

type Resultado = { ok: boolean; error?: string }

function atualizar(departmentId?: string) {
  revalidatePath("/operacional")
  revalidatePath("/rh/efetivos")
  if (departmentId) revalidatePath(`/rh/efetivos/${departmentId}`)
}

export async function criarVaga(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = coberturaVagaSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const check = await checkPostoEdit("PAINEL", parsed.data.departmentId)
  if ("erro" in check) return { errors: { departmentId: [check.erro] } }

  const { ausenteId, origemMovementId, ...dados } = parsed.data
  await prisma.coberturaVaga.create({
    data: {
      ...dados,
      ausenteId: ausenteId || null,
      origemMovementId: origemMovementId || null,
      criadaPor: actorName(check.access),
    },
  })

  atualizar(parsed.data.departmentId)
  return { message: "ok" }
}

/**
 * Confirma uma sugestão vinda de um movimento de falta/férias. É o mesmo
 * registro do criarVaga, só que sem formulário: o posto, a pessoa e o motivo
 * já vêm do movimento e a pessoa só escolhe o turno.
 */
export async function criarVagaDaSugestao(input: {
  movementId: string
  periodo: "DIURNO" | "NOTURNO"
  dateStr: string
}): Promise<Resultado> {
  const movimento = await prisma.movement.findUnique({
    where: { id: input.movementId },
    select: {
      id: true, type: true,
      employee: { select: { id: true, name: true, departmentId: true } },
    },
  })
  if (!movimento?.employee.departmentId) {
    return { ok: false, error: "Movimento sem posto vinculado." }
  }

  const check = await checkPostoEdit("PAINEL", movimento.employee.departmentId)
  if ("erro" in check) return { ok: false, error: check.erro }

  const date = new Date(`${input.dateStr}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Data inválida." }

  // A mesma ausência não pode virar duas baixas no mesmo turno — a sugestão
  // pode ser clicada duas vezes antes da tela recarregar.
  const existente = await prisma.coberturaVaga.findFirst({
    where: {
      origemMovementId: movimento.id,
      date,
      periodo: input.periodo,
      status: { not: "CANCELADA" },
    },
    select: { id: true },
  })
  if (existente) return { ok: false, error: "Esta baixa já foi aberta." }

  await prisma.coberturaVaga.create({
    data: {
      departmentId: movimento.employee.departmentId,
      date,
      periodo: input.periodo,
      motivo: movimento.type === "FERIAS" ? "FERIAS" : "FALTA",
      ausenteId: movimento.employee.id,
      origemMovementId: movimento.id,
      observacao: `Aberta a partir do movimento de ${movimento.type.toLowerCase()} de ${movimento.employee.name}.`,
      criadaPor: actorName(check.access),
    },
  })

  atualizar(movimento.employee.departmentId)
  return { ok: true }
}

export async function cancelarVaga(id: string): Promise<Resultado> {
  const vaga = await prisma.coberturaVaga.findUnique({
    where: { id },
    select: { departmentId: true, status: true },
  })
  if (!vaga) return { ok: false, error: "Baixa não encontrada." }

  const check = await checkPostoEdit("PAINEL", vaga.departmentId)
  if ("erro" in check) return { ok: false, error: check.erro }

  // Convite em aberto de uma baixa cancelada vira mensagem órfã: se a pessoa
  // responder depois, não há mais vaga para preencher.
  await prisma.$transaction([
    prisma.coberturaVaga.update({
      where: { id },
      data: { status: "CANCELADA" },
    }),
    prisma.coberturaConvite.updateMany({
      where: { vagaId: id, etapa: { not: "CONCLUIDO" } },
      data: { status: "CANCELADO", etapa: "CONCLUIDO" },
    }),
  ])

  atualizar(vaga.departmentId)
  return { ok: true }
}

/**
 * Fecha a baixa com quem vai cobrir e lança o efetivo extra do dia.
 *
 * O evento fica como "Sem alteração" de propósito: qualquer outro código gera
 * pendência documental automática no módulo de efetivos, e uma cobertura de
 * extra não nasce devendo documento.
 */
export async function confirmarCobertura(
  vagaId: string,
  employeeId: string
): Promise<Resultado> {
  const [vaga, employee] = await Promise.all([
    prisma.coberturaVaga.findUnique({
      where: { id: vagaId },
      select: {
        id: true, departmentId: true, date: true, periodo: true,
        horario: true, status: true,
      },
    }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true },
    }),
  ])
  if (!vaga) return { ok: false, error: "Baixa não encontrada." }
  if (vaga.status !== "ABERTA") return { ok: false, error: "Esta baixa já foi encerrada." }
  if (!employee) return { ok: false, error: "Colaborador não encontrado." }

  const check = await checkPostoEdit("PAINEL", vaga.departmentId)
  if ("erro" in check) return { ok: false, error: check.erro }

  const efetivo = await prisma.efetivo.create({
    data: {
      departmentId: vaga.departmentId,
      employeeId: employee.id,
      date: vaga.date,
      periodo: vaga.periodo,
      horario: vaga.horario,
      evento: EFETIVO_EVENTO_SEM_ALTERACAO,
      extra: true,
    },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.coberturaVaga.update({
      where: { id: vagaId },
      data: {
        status: "PREENCHIDA",
        cobertaPorId: employee.id,
        cobertaEm: new Date(),
        efetivoId: efetivo.id,
      },
    }),
    // Os demais convidados não recebem aviso: o convite já dizia que era
    // oportunidade, e mandar "não precisa mais" a cada baixa preenchida
    // transformaria o extra num canal de mensagens indesejadas.
    prisma.coberturaConvite.updateMany({
      where: { vagaId, etapa: { not: "CONCLUIDO" }, employeeId: { not: employee.id } },
      data: { status: "CANCELADO", etapa: "CONCLUIDO" },
    }),
  ])

  atualizar(vaga.departmentId)
  revalidatePath("/rh/efetivos/ausencias")
  return { ok: true }
}

export async function convocarParaExtra(
  vagaId: string,
  employeeId: string
): Promise<Resultado> {
  const vaga = await prisma.coberturaVaga.findUnique({
    where: { id: vagaId },
    select: { departmentId: true },
  })
  if (!vaga) return { ok: false, error: "Baixa não encontrada." }

  const check = await checkPostoEdit("PAINEL", vaga.departmentId)
  if ("erro" in check) return { ok: false, error: check.erro }

  const envio = await enviarConviteExtra({
    vagaId,
    employeeId,
    criadoPor: actorName(check.access),
  })

  atualizar(vaga.departmentId)
  return { ok: envio.ok, error: envio.error }
}

/**
 * Desfaz o "não receber mais mensagens". Fica no cadastro do colaborador (não
 * no painel) porque só deve acontecer quando a própria pessoa pedir de volta.
 */
export async function reativarWhatsapp(employeeId: string): Promise<Resultado> {
  const user = await requireModuloEdit("COLABORADORES")
  const alvo = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true },
  })
  if (!alvo || !podeVerPosto(user, alvo.departmentId)) {
    return { ok: false, error: "Este colaborador não está no seu acesso." }
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: { whatsappOptOut: false, whatsappOptOutAt: null },
  })
  revalidatePath("/rh")
  revalidatePath(`/rh/${employeeId}`)
  revalidatePath("/operacional")
  return { ok: true }
}

