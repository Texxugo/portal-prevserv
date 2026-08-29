"use server"

import { revalidatePath } from "next/cache"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { conciliarEmpregados, parseEmpregados } from "@/lib/import/empregados"
import { parseSheetRows } from "@/lib/import/parse-sheet"

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
      updatedCount?: number
    }
  | undefined

const LAYOUT_INVALIDO =
  "Não foi possível reconhecer o layout. Use o relatório de empregados: a razão social abrindo cada bloco e o cabeçalho Código / Nome / Nº do C.P.F. acima das linhas."

function readFile(formData: FormData): File | null {
  const file = formData.get("file")
  return file instanceof File && file.size > 0 ? file : null
}

// ---------- Colaboradores ----------
export async function importEmployees(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireModuloEdit("COLABORADORES")
  const file = readFile(formData)
  if (!file)
    return { status: "error", message: "Selecione um arquivo .xls, .xlsx ou .csv." }
  const confirm = formData.get("confirm") === "1"

  let sheet: string[][]
  try {
    sheet = await parseSheetRows(file)
  } catch {
    return { status: "error", message: "Não foi possível ler o arquivo." }
  }
  if (sheet.length === 0) return { status: "error", message: "A planilha está vazia." }

  const registros = parseEmpregados(sheet)
  if (registros.length === 0) return { status: "error", message: LAYOUT_INVALIDO }

  const cadastrados = await prisma.employee.findMany({
    select: { id: true, name: true, empresa: true, cpf: true, matricula: true },
  })
  const conciliados = conciliarEmpregados(registros, cadastrados)

  const rows: ImportRowResult[] = conciliados.map((c) => ({
    line: c.linha,
    cells: c.cells,
    errors: c.errors,
  }))
  const aplicar = conciliados.filter((c) => c.errors.length === 0)
  const validCount = aplicar.length
  const errorCount = rows.length - validCount

  if (!confirm) {
    return { status: "preview", rows: rows.slice(0, 500), validCount, errorCount }
  }

  let inserted = 0
  let updated = 0
  for (const item of aplicar) {
    const data = {
      name: item.cells.name,
      empresa: item.cells.empresa || null,
      matricula: item.cells.matricula || null,
      cpf: item.cells.cpf || null,
    }
    try {
      if (item.alvoId) {
        await prisma.employee.update({ where: { id: item.alvoId }, data })
        updated++
      } else {
        await prisma.employee.create({ data })
        inserted++
      }
    } catch {
      // ignora duplicados/erros pontuais
    }
  }
  revalidatePath("/rh")
  return {
    status: "done",
    insertedCount: inserted,
    updatedCount: updated,
    validCount,
    errorCount,
  }
}
