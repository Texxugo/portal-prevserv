"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { escalaSchema } from "@/lib/schemas"

type Result = { ok: boolean; error?: string }

function nameConflict(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  )
}

export async function createEscala(
  name: string,
  cycleDays: string
): Promise<Result> {
  await requireSectorEdit("rh")
  const parsed = escalaSchema.safeParse({ name, cycleDays })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }
  try {
    await prisma.escala.create({ data: parsed.data })
  } catch (e) {
    if (nameConflict(e)) return { ok: false, error: "Já existe uma escala com este nome." }
    throw e
  }
  revalidatePath("/rh/escalas")
  return { ok: true }
}

export async function updateEscala(
  id: string,
  name: string,
  cycleDays: string
): Promise<Result> {
  await requireSectorEdit("rh")
  const parsed = escalaSchema.safeParse({ name, cycleDays })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }
  try {
    await prisma.escala.update({ where: { id }, data: parsed.data })
  } catch (e) {
    if (nameConflict(e)) return { ok: false, error: "Já existe uma escala com este nome." }
    throw e
  }
  revalidatePath("/rh/escalas")
  return { ok: true }
}

export async function deleteEscala(id: string): Promise<Result> {
  await requireSectorEdit("rh")
  await prisma.escala.delete({ where: { id } })
  revalidatePath("/rh/escalas")
  return { ok: true }
}
