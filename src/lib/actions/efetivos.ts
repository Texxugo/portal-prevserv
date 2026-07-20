"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { z } from "zod"

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

const DOCUMENTO_TIPO_EFETIVO = "Documento de efetivo"

function buildData(parsed: z.infer<typeof efetivoSchema>) {
  const horario =
    parsed.horarioEntrada && parsed.horarioSaida
      ? `${parsed.horarioEntrada} - ${parsed.horarioSaida}`
      : parsed.horarioEntrada ?? parsed.horarioSaida ?? parsed.horario

  return {
    employeeId: parsed.employeeId,
    freelancerName: parsed.employeeId ? null : parsed.freelancerName,
    departmentId: parsed.departmentId,
    date: parsed.date,
    horario,
    local: parsed.local,
    evento: parsed.evento,
    periodo: parsed.periodo,
    extra: parsed.extra,
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

  const [department, employee] = await Promise.all([
    prisma.department.findUnique({
      where: { id: data.departmentId },
      select: { id: true, name: true },
    }),
    data.employeeId
      ? prisma.employee.findUnique({
          where: { id: data.employeeId },
          select: { id: true, name: true, matricula: true },
        })
      : Promise.resolve(null),
  ])
  if (!department) return { errors: { departmentId: ["Posto não encontrado"] } }
  if (data.employeeId && !employee) {
    return { errors: { employeeId: ["Colaborador não encontrado"] } }
  }

  const pessoaName = employee?.name ?? data.freelancerName ?? ""

  const shouldCreatePendencia = data.evento !== EFETIVO_EVENTO_SEM_ALTERACAO
  const documentPendencias = shouldCreatePendencia
    ? {
        create: {
          employeeId: employee?.id ?? null,
          employeeName: pessoaName,
          matricula: employee?.matricula ?? null,
          competencia: competenciaFromDate(data.date),
          documentTypeId: (
            (await prisma.documentoTipo.findFirst({
              where: { name: DOCUMENTO_TIPO_EFETIVO },
            })) ??
            (await prisma.documentoTipo.create({
              data: { name: DOCUMENTO_TIPO_EFETIVO },
            }))
          ).id,
          sourceDate: data.date,
          sourceType: "EFETIVO",
          sourceDetail: `Evento ${data.evento} — ${department.name}`,
          reason: `Evento ${data.evento} em ${formatDate(data.date)} no posto ${department.name}`,
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
      ...buildData(data),
      ...(documentPendencias ? { documentPendencias } : {}),
    },
  })

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
    data: buildData(parsed.data),
  })
  refresh(parsed.data.departmentId)
  redirect(
    `/rh/efetivos/${parsed.data.departmentId}?date=${formatDateInput(parsed.data.date)}`
  )
}

export async function deleteEfetivo(id: string): Promise<void> {
  await requireSectorEdit("rh")
  const efetivo = await prisma.efetivo.delete({ where: { id } })
  refresh(efetivo.departmentId)
}
