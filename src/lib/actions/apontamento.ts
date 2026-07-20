"use server"

import { revalidatePath } from "next/cache"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { apontamentoSchema } from "@/lib/schemas"

// Forma enviada pela grade (valores já tipados; vazios = null).
export type ApontamentoInput = {
  employeeId: string
  competencia: string
  total: number
  valeTransporte: number
  valeRefeicao: number
  adicionalNoturno: number | null
  he50: string | null
  he100: string | null
  intra: number | null
  faltasE: number | null
  faltasF: number | null
  faltasJust: number | null
  faltasNJust: number | null
  dsr: number | null
  gratPercent: number | null
  recebeCesta: boolean
  recebeAssiduidade: boolean
  observacoes: string | null
}

export async function salvarApontamento(
  input: ApontamentoInput
): Promise<{ ok: boolean; error?: string }> {
  await requireSectorEdit("rh")

  const parsed = apontamentoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos." }
  }

  const { employeeId, competencia, ...data } = parsed.data
  await prisma.apontamento.upsert({
    where: { employeeId_competencia: { employeeId, competencia } },
    create: { employeeId, competencia, ...data },
    update: data,
  })

  revalidatePath("/rh/apontamento")
  return { ok: true }
}
