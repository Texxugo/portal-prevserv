"use server"

import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { employeeSchema } from "@/lib/schemas"
import { mapRow, normalizeKey, parseSheet } from "@/lib/import/parse-sheet"

export type ImportRowResult = {
  line: number
  cells: Record<string, string>
  errors: string[]
}

export type ImportState =
  | {
      status: "preview" | "done" | "error"
      message?: string
      rows?: ImportRowResult[]
      validCount?: number
      errorCount?: number
      insertedCount?: number
    }
  | undefined

const EMPLOYEE_HEADERS: Record<string, string> = {
  nome: "name",
  matricula: "matricula",
  cpf: "cpf",
  email: "email",
  "e-mail": "email",
  telefone: "phone",
  ramal: "phone",
  "telefone/ramal": "phone",
  cargo: "position",
  departamento: "department",
  admissao: "admissionDate",
  "data de admissao": "admissionDate",
  salario: "salary",
  situacao: "status",
  status: "status",
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  matricula: "Matrícula",
  cpf: "CPF",
  email: "E-mail",
  salary: "Salário",
  status: "Situação",
  admissionDate: "Admissão",
}

function readFile(formData: FormData): File | null {
  const file = formData.get("file")
  return file instanceof File && file.size > 0 ? file : null
}

// ---------- Colaboradores ----------
export async function importEmployees(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireSectorEdit("rh")
  const file = readFile(formData)
  if (!file) return { status: "error", message: "Selecione um arquivo .xlsx ou .csv." }
  const confirm = formData.get("confirm") === "1"

  let raw: Record<string, unknown>[]
  try {
    raw = await parseSheet(file)
  } catch {
    return { status: "error", message: "Não foi possível ler o arquivo." }
  }
  if (raw.length === 0)
    return { status: "error", message: "A planilha está vazia ou sem cabeçalho." }

  const departments = await prisma.department.findMany()
  const depByName = new Map(departments.map((d) => [normalizeKey(d.name), d.id]))

  const rows: ImportRowResult[] = []
  const toInsert: z.infer<typeof employeeSchema>[] = []

  raw.forEach((r, i) => {
    const m = mapRow(r, EMPLOYEE_HEADERS)
    const errors: string[] = []

    const depName = m.department ?? ""
    let departmentId = ""
    if (depName) {
      const found = depByName.get(normalizeKey(depName))
      if (found) departmentId = found
      else errors.push(`Departamento "${depName}" não encontrado`)
    }

    const candidate = {
      name: m.name ?? "",
      matricula: m.matricula ?? "",
      cpf: m.cpf ?? "",
      email: m.email ?? "",
      phone: m.phone ?? "",
      position: m.position ?? "",
      departmentId,
      admissionDate: m.admissionDate ?? "",
      salary: m.salary ?? "",
      status: m.status ? m.status.toUpperCase() : "ATIVO",
    }

    const parsed = employeeSchema.safeParse(candidate)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string
        errors.push(`${FIELD_LABELS[key] ?? key}: ${issue.message}`)
      }
    }

    rows.push({
      line: i + 2,
      cells: {
        name: candidate.name,
        matricula: candidate.matricula,
        cpf: candidate.cpf,
        email: candidate.email,
        phone: candidate.phone,
        position: candidate.position,
        department: depName,
        admissionDate: candidate.admissionDate,
        salary: candidate.salary,
        status: candidate.status,
      },
      errors,
    })

    if (parsed.success && errors.length === 0) toInsert.push(parsed.data)
  })

  const validCount = toInsert.length
  const errorCount = rows.length - validCount

  if (!confirm) {
    return { status: "preview", rows: rows.slice(0, 500), validCount, errorCount }
  }

  let inserted = 0
  for (const data of toInsert) {
    try {
      await prisma.employee.create({ data })
      inserted++
    } catch {
      // ignora duplicados/erros pontuais
    }
  }
  revalidatePath("/rh")
  return { status: "done", insertedCount: inserted, validCount, errorCount }
}
