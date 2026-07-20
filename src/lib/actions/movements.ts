"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { z } from "zod"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { competenciaFromDate } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import { movementSchema } from "@/lib/schemas"

function buildData(parsed: z.infer<typeof movementSchema>) {
  return {
    employeeId: parsed.employeeId,
    type: parsed.type,
    justificada: parsed.type === "FALTA" ? parsed.justificada : null,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    note: parsed.note,
    competencia: competenciaFromDate(parsed.startDate),
  }
}

export async function createMovement(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("rh")
  const parsed = movementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const data = buildData(parsed.data)
  await prisma.movement.create({ data })
  revalidatePath("/rh/movimentos")
  redirect(`/rh/movimentos?comp=${data.competencia}`)
}

export async function updateMovement(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("rh")
  const parsed = movementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const data = buildData(parsed.data)
  await prisma.movement.update({ where: { id }, data })
  revalidatePath("/rh/movimentos")
  redirect(`/rh/movimentos?comp=${data.competencia}`)
}

export async function deleteMovement(id: string): Promise<void> {
  await requireSectorEdit("rh")
  await prisma.movement.delete({ where: { id } })
  revalidatePath("/rh/movimentos")
}
