"use server"

import { revalidatePath } from "next/cache"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { apontamentoSchema } from "@/lib/schemas"
import { horasParaDuracao, parseApontamentoTxt } from "@/lib/apontamento/parse-txt"
import { buildEmployeeIndex, sugerirParecido } from "@/lib/employee-match"

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
  await requireModuloEdit("APONTAMENTO")

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

// Salva vários apontamentos de uma vez (usado pelo import de TXT). Tudo ou nada:
// meia importação gravada seria pior que nenhuma, porque não dá para saber onde
// parou só olhando a grade.
export async function salvarApontamentosEmLote(
  inputs: ApontamentoInput[]
): Promise<{ ok: boolean; error?: string; falhaEmployeeId?: string; salvos: number }> {
  await requireModuloEdit("APONTAMENTO")

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: "Nada para salvar.", salvos: 0 }
  }

  const ops = []
  for (const input of inputs) {
    const parsed = apontamentoSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Dados inválidos.",
        falhaEmployeeId: input?.employeeId,
        salvos: 0,
      }
    }
    const { employeeId, competencia, ...data } = parsed.data
    ops.push(
      prisma.apontamento.upsert({
        where: { employeeId_competencia: { employeeId, competencia } },
        create: { employeeId, competencia, ...data },
        update: data,
      })
    )
  }

  await prisma.$transaction(ops)

  revalidatePath("/rh/apontamento")
  return { ok: true, salvos: ops.length }
}

// ---------- Import da planilha TXT ----------

// Campos que o arquivo alimenta. Os que não aparecem nele (HE 100%, faltas E/F,
// gratificação, premiações, observações) ficam como estavam na tela.
export type ApontamentoImportCampos = {
  total: number
  valeTransporte: number
  valeRefeicao: number
  adicionalNoturno: number | null
  he50: string | null
  intra: number | null
  faltasJust: number | null
  faltasNJust: number | null
  dsr: number | null
}

// `parecido` é só uma dica de grafia para o RH conferir o cadastro — o import
// não grava nada com base nela.
export type ApontamentoImportNaoEncontrado = { nome: string; parecido: string | null }

export type ApontamentoImportResumo = {
  linhas: number
  preenchidos: number
  naoEncontrados: ApontamentoImportNaoEncontrado[]
  ambiguos: string[]
  repetidos: string[]
}

export type ApontamentoImportResult =
  | { status: "error"; message: string }
  | {
      status: "ok"
      itens: { employeeId: string; campos: ApontamentoImportCampos }[]
      resumo: ApontamentoImportResumo
    }

const inteiro = (n: number | null): number =>
  n === null || !Number.isFinite(n) ? 0 : Math.max(0, Math.round(n))

// Campos opcionais: zero no arquivo = campo vazio, senão o DOCX passaria a
// imprimir "FALTAS JUST: 0" para o time inteiro.
const inteiroOpcional = (n: number | null): number | null => inteiro(n) || null

export async function importarApontamentoTxt(
  formData: FormData
): Promise<ApontamentoImportResult> {
  await requireModuloEdit("APONTAMENTO")

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione o arquivo TXT do apontamento." }
  }

  const parsed = parseApontamentoTxt(await file.arrayBuffer())
  if (!parsed.ok) return { status: "error", message: parsed.erro }

  const employees = await prisma.employee.findMany({
    where: { status: { not: "INATIVO" } },
    select: { id: true, name: true, matricula: true },
  })
  const index = buildEmployeeIndex(employees)

  const naoEncontrados = new Set<string>()
  const ambiguos = new Set<string>()
  const repetidos = new Set<string>()

  // O arquivo só traz o nome — sem matrícula, o casamento é por nome normalizado.
  const porEmployee = new Map<string, { nome: string; campos: ApontamentoImportCampos }[]>()

  for (const linha of parsed.linhas) {
    const match = index.findDetalhado("", linha.nome)
    if (!match.employee) {
      if (match.ambiguo) ambiguos.add(linha.nome)
      else naoEncontrados.add(linha.nome)
      continue
    }
    const campos: ApontamentoImportCampos = {
      total: inteiro(linha.total),
      valeTransporte: inteiro(linha.diasTrabalhados),
      valeRefeicao: inteiro(linha.vr),
      adicionalNoturno: inteiroOpcional(linha.adicionalNoturno),
      he50: horasParaDuracao(linha.horasExtras),
      intra: inteiroOpcional(linha.intra),
      faltasJust: inteiroOpcional(linha.faltasJust),
      faltasNJust: inteiroOpcional(linha.faltasNJust),
      dsr: inteiroOpcional(linha.dsr),
    }
    const atuais = porEmployee.get(match.employee.id) ?? []
    atuais.push({ nome: linha.nome, campos })
    porEmployee.set(match.employee.id, atuais)
  }

  // Duas linhas para o mesmo cadastro (nome repetido no arquivo, ou dois nomes
  // que caem na mesma pessoa) não têm resposta única — ficam de fora e são
  // listadas para lançamento manual.
  const itens: { employeeId: string; campos: ApontamentoImportCampos }[] = []
  for (const [employeeId, linhas] of porEmployee) {
    if (linhas.length > 1) {
      for (const l of linhas) repetidos.add(l.nome)
      continue
    }
    itens.push({ employeeId, campos: linhas[0].campos })
  }

  return {
    status: "ok",
    itens,
    resumo: {
      linhas: parsed.linhas.length,
      preenchidos: itens.length,
      naoEncontrados: [...naoEncontrados].map((nome) => ({
        nome,
        parecido: sugerirParecido(nome, employees)?.name ?? null,
      })),
      ambiguos: [...ambiguos],
      repetidos: [...repetidos],
    },
  }
}
