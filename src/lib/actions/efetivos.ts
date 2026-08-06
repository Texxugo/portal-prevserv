"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { actorName, requireSectorEdit } from "@/lib/auth-helpers"
import { competenciaFromDate } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import { formatDate, formatDateInput } from "@/lib/format"
import {
  EFETIVO_EVENTO_SEM_ALTERACAO,
  efetivoCreateSchema,
  efetivoSchema,
} from "@/lib/schemas"
import { sendGroupText } from "@/lib/zapi"

const DOCUMENTO_TIPO_EFETIVO = "Documento de efetivo"

type CamposComuns = {
  departmentId: string
  date: Date
  periodo: string
}

// evento e extra são por pessoa (cada linha do lote tem os seus)
type Pessoa = {
  employeeId: string | null
  freelancerName: string | null
  local: string | null
  horarioEntrada: string | null
  horarioSaida: string | null
  horario?: string | null // texto legado (só na edição)
  evento: string
  extra: boolean
}

function buildData(comuns: CamposComuns, p: Pessoa) {
  const horario =
    p.horarioEntrada && p.horarioSaida
      ? `${p.horarioEntrada} - ${p.horarioSaida}`
      : p.horarioEntrada ?? p.horarioSaida ?? p.horario ?? null

  return {
    employeeId: p.employeeId,
    freelancerName: p.employeeId ? null : p.freelancerName,
    departmentId: comuns.departmentId,
    date: comuns.date,
    horario,
    local: p.local,
    evento: p.evento,
    periodo: comuns.periodo,
    extra: p.extra,
  }
}

function refresh(departmentId: string) {
  revalidatePath("/rh/efetivos")
  revalidatePath(`/rh/efetivos/${departmentId}`)
  revalidatePath("/rh/pendencias")
  revalidatePath("/")
}

export async function createEfetivo(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireSectorEdit("rh")
  const parsed = efetivoCreateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }
  const data = parsed.data

  // Base operacional (se informada) entra como mais um registro do dia. É só
  // presença: sem evento próprio, não gera pendência de documento.
  const pessoas: Pessoa[] = [
    ...(data.baseOperacionalId
      ? [
          {
            employeeId: data.baseOperacionalId,
            freelancerName: null,
            local: null,
            horarioEntrada: null,
            horarioSaida: null,
            evento: EFETIVO_EVENTO_SEM_ALTERACAO,
            extra: false,
          },
        ]
      : []),
    ...data.linhas,
  ]

  const idsUsados = pessoas
    .map((p) => p.employeeId)
    .filter((id): id is string => !!id)

  const [department, employees] = await Promise.all([
    prisma.department.findUnique({
      where: { id: data.departmentId },
      select: { id: true, name: true },
    }),
    idsUsados.length
      ? prisma.employee.findMany({
          where: { id: { in: idsUsados } },
          select: { id: true, name: true, matricula: true },
        })
      : Promise.resolve([]),
  ])
  if (!department) return { errors: { departmentId: ["Posto não encontrado"] } }
  if (employees.length !== new Set(idsUsados).size) {
    return { errors: { linhas: ["Colaborador não encontrado"] } }
  }

  // o tipo de documento só é criado se alguma linha exigir pendência
  const documentTypeId = pessoas.some(
    (p) => p.evento !== EFETIVO_EVENTO_SEM_ALTERACAO
  )
    ? (
        (await prisma.documentoTipo.findFirst({
          where: { name: DOCUMENTO_TIPO_EFETIVO },
        })) ??
        (await prisma.documentoTipo.create({
          data: { name: DOCUMENTO_TIPO_EFETIVO },
        }))
      ).id
    : null

  for (const pessoa of pessoas) {
    const employee = pessoa.employeeId
      ? employees.find((e) => e.id === pessoa.employeeId)
      : null
    const documentPendencias =
      pessoa.evento !== EFETIVO_EVENTO_SEM_ALTERACAO && documentTypeId
        ? {
            create: {
              employeeId: employee?.id ?? null,
              employeeName: employee?.name ?? pessoa.freelancerName ?? "",
              matricula: employee?.matricula ?? null,
              competencia: competenciaFromDate(data.date),
              documentTypeId,
              sourceDate: data.date,
              sourceType: "EFETIVO",
              sourceDetail: `Evento ${pessoa.evento} — ${department.name}`,
              reason: `Evento ${pessoa.evento} em ${formatDate(data.date)} no posto ${department.name}`,
              followUpDate:
                data.temDocumento === "sim"
                  ? data.date
                  : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              status: data.temDocumento === "sim" ? "RECEBIDO" : "PENDENTE",
              externalUrl: data.temDocumento === "sim" ? data.documentoUrl : null,
              receivedAt: data.temDocumento === "sim" ? new Date() : null,
              createdById: user.id,
              createdByName: actorName(user),
              history: {
                create: {
                  action: data.temDocumento === "sim" ? "RECEBIDA" : "CRIADA",
                  description:
                    data.temDocumento === "sim"
                      ? "Documento vinculado no cadastro do efetivo."
                      : "Pendência criada automaticamente pelo cadastro de efetivo (sem documento).",
                  actorUserId: user.id,
                  actorName: actorName(user),
                },
              },
            },
          }
        : undefined

    await prisma.efetivo.create({
      data: {
        ...buildData(data, pessoa),
        ...(documentPendencias ? { documentPendencias } : {}),
      },
    })
  }

  refresh(department.id)
  redirect(`/rh/efetivos/${department.id}?date=${formatDateInput(data.date)}`)
}

export async function updateEfetivo(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("rh")
  const parsed = efetivoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  await prisma.efetivo.update({
    where: { id },
    data: buildData(parsed.data, parsed.data),
  })
  refresh(parsed.data.departmentId)
  redirect(
    `/rh/efetivos/${parsed.data.departmentId}?date=${formatDateInput(parsed.data.date)}`
  )
}

// Envia o efetivo do turno ao grupo do posto. Ao contrário do relatório, aqui
// não há fechamento nem código: o efetivo muda ao longo do dia, então o envio é
// sempre um ato explícito do usuário (o botão), nunca automático.
export async function enviarEfetivoAoGrupo(
  departmentId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  await requireSectorEdit("rh")

  if (message.trim().length < 10) {
    return { ok: false, error: "Mensagem vazia." }
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { name: true, whatsappGrupoId: true },
  })
  if (!department) return { ok: false, error: "Posto não encontrado." }
  if (!department.whatsappGrupoId) {
    return {
      ok: false,
      error: `${department.name} não tem grupo de WhatsApp cadastrado. Configure em Departamentos.`,
    }
  }

  const result = await sendGroupText(department.whatsappGrupoId, message)
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Falha ao enviar." }
}

export async function deleteEfetivo(id: string): Promise<void> {
  await requireSectorEdit("rh")
  const efetivo = await prisma.efetivo.delete({ where: { id } })
  refresh(efetivo.departmentId)
}
