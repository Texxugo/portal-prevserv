"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import { userCreateSchema, userUpdateSchema } from "@/lib/schemas"

export async function createUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("admin")
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const { password, ...rest } = parsed.data
  const hash = await bcrypt.hash(password, 10)

  try {
    await prisma.user.create({ data: { ...rest, password: hash } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["Já existe um usuário com este e-mail."] } }
    }
    throw e
  }

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios")
}

export async function updateUser(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("admin")
  const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const { password, ...rest } = parsed.data
  const data: Prisma.UserUpdateInput = { ...rest }
  if (password) data.password = await bcrypt.hash(password, 10)

  try {
    await prisma.user.update({ where: { id }, data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["Já existe um usuário com este e-mail."] } }
    }
    throw e
  }

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios")
}

export async function deleteUser(id: string): Promise<void> {
  const me = await requireSectorEdit("admin")
  if (me.id === id) {
    throw new Error("Não é possível excluir o próprio usuário.")
  }
  await prisma.user.delete({ where: { id } })
  revalidatePath("/admin/usuarios")
}
