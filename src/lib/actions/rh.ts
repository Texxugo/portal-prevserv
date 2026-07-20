"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import { departmentSchema, employeeSchema } from "@/lib/schemas"

// ---------- Colaboradores ----------
export async function createEmployee(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("rh")
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  try {
    await prisma.employee.create({ data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "")
      if (target.includes("matricula")) {
        return { errors: { matricula: ["Já existe um colaborador com esta matrícula."] } }
      }
      return { errors: { cpf: ["Já existe um colaborador com este CPF."] } }
    }
    throw e
  }

  revalidatePath("/rh")
  redirect("/rh")
}

export async function updateEmployee(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("rh")
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  try {
    await prisma.employee.update({ where: { id }, data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "")
      if (target.includes("matricula")) {
        return { errors: { matricula: ["Já existe um colaborador com esta matrícula."] } }
      }
      return { errors: { cpf: ["Já existe um colaborador com este CPF."] } }
    }
    throw e
  }

  revalidatePath("/rh")
  redirect("/rh")
}

export async function deleteEmployee(id: string): Promise<void> {
  await requireSectorEdit("rh")
  await prisma.employee.delete({ where: { id } })
  revalidatePath("/rh")
}

// ---------- Departamentos ----------
export async function createDepartment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSectorEdit("rh")
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  try {
    await prisma.department.create({ data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { name: ["Já existe um departamento com este nome."] } }
    }
    throw e
  }

  revalidatePath("/rh/departamentos")
  return { message: "ok" }
}

export async function deleteDepartment(id: string): Promise<void> {
  await requireSectorEdit("rh")
  await prisma.department.delete({ where: { id } })
  revalidatePath("/rh/departamentos")
}
