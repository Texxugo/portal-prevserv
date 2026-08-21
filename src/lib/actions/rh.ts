"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { normalizeCep } from "@/lib/geo/endereco"
import { geocodificarEmployee } from "@/lib/geo/geocodificar"
import { toFieldErrors, type FormState } from "@/lib/form"
import { podeVerPosto } from "@/lib/permissions"
import { departmentSchema, employeeSchema } from "@/lib/schemas"
import {
  isGrupoIdValido,
  listGroups,
  normalizeGrupoId,
  type GrupoWhatsapp,
} from "@/lib/zapi"

const POSTO_FORA_DO_ACESSO = "Este posto não está no seu acesso."

// Campos que, mudando, invalidam a coordenada guardada.
const CAMPOS_ENDERECO = [
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "endereco",
] as const

type CamposEndereco = Partial<Record<(typeof CAMPOS_ENDERECO)[number], string | null>>

function normalizarEndereco<T extends CamposEndereco>(dados: T): T {
  return {
    ...dados,
    cep: dados.cep ? normalizeCep(dados.cep) : null,
    uf: dados.uf ? dados.uf.toUpperCase() : null,
  }
}

function enderecoMudou(antes: CamposEndereco, depois: CamposEndereco): boolean {
  return CAMPOS_ENDERECO.some((c) => (antes[c] ?? "") !== (depois[c] ?? ""))
}

// A geocodificação roda junto com o salvamento (uma chamada ao Nominatim, ~1s)
// para que o alfinete apareça no painel sem depender de um segundo clique. O
// erro não derruba o cadastro: o endereço fica salvo e a tela de colaboradores
// mostra quem ficou sem localização.
async function localizarNoMapa(id: string) {
  try {
    await geocodificarEmployee(id)
  } catch (e) {
    console.error("[rh] falha ao geocodificar colaborador:", e)
  }
}

// ---------- Colaboradores ----------
export async function createEmployee(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireModuloEdit("COLABORADORES")
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  if (!podeVerPosto(user, parsed.data.departmentId)) {
    return { errors: { departmentId: [POSTO_FORA_DO_ACESSO] } }
  }

  const dados = normalizarEndereco(parsed.data)

  try {
    const criado = await prisma.employee.create({
      data: dados,
      select: { id: true },
    })
    await localizarNoMapa(criado.id)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "")
      if (target.includes("matricula")) {
        return {
          errors: {
            matricula: ["Já existe um colaborador com esta matrícula nesta empresa."],
          },
        }
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
  const user = await requireModuloEdit("COLABORADORES")
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const atual = await prisma.employee.findUnique({
    where: { id },
    select: {
      departmentId: true, cep: true, logradouro: true, numero: true,
      complemento: true, bairro: true, cidade: true, uf: true, endereco: true,
    },
  })
  // Vale para a origem e para o destino: tirar alguém de um posto fora do
  // escopo é tão indevido quanto trazê-lo para dentro dele.
  if (
    !atual ||
    !podeVerPosto(user, atual.departmentId) ||
    !podeVerPosto(user, parsed.data.departmentId)
  ) {
    return { errors: { departmentId: [POSTO_FORA_DO_ACESSO] } }
  }

  const dados = normalizarEndereco(parsed.data)
  const mudou = enderecoMudou(atual, dados)

  try {
    await prisma.employee.update({
      where: { id },
      data: mudou
        ? { ...dados, lat: null, lng: null, geocodedAt: null, geocodeStatus: null }
        : dados,
    })
    if (mudou) await localizarNoMapa(id)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "")
      if (target.includes("matricula")) {
        return {
          errors: {
            matricula: ["Já existe um colaborador com esta matrícula nesta empresa."],
          },
        }
      }
      return { errors: { cpf: ["Já existe um colaborador com este CPF."] } }
    }
    throw e
  }

  revalidatePath("/rh")
  redirect("/rh")
}

export async function deleteEmployee(id: string): Promise<void> {
  const user = await requireModuloEdit("COLABORADORES")
  const alvo = await prisma.employee.findUnique({
    where: { id },
    select: { departmentId: true },
  })
  if (!alvo || !podeVerPosto(user, alvo.departmentId)) return
  await prisma.employee.delete({ where: { id } })
  revalidatePath("/rh")
}

// ---------- Departamentos ----------
export async function createDepartment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireModuloEdit("DEPARTAMENTOS")
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

// Lista os grupos da conta conectada, para escolher o do posto sem precisar
// descobrir o ID por fora. Consulta de leitura — não envia mensagem.
export async function listarGruposWhatsapp(): Promise<{
  ok: boolean
  grupos?: GrupoWhatsapp[]
  error?: string
}> {
  await requireModuloEdit("DEPARTAMENTOS")
  return listGroups()
}

// Grupo de WhatsApp do posto: destino do relatório diário ao ser finalizado.
// Vazio remove o vínculo e o posto volta a depender de copiar e colar.
export async function setDepartmentGrupo(
  id: string,
  grupoId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireModuloEdit("DEPARTAMENTOS")
  const valor = grupoId.trim()

  if (valor && !isGrupoIdValido(valor)) {
    return {
      ok: false,
      error:
        "ID de grupo inválido. Use o ID do grupo na Z-API (só números, com ou sem @g.us) — não o telefone.",
    }
  }

  await prisma.department.update({
    where: { id },
    data: { whatsappGrupoId: valor ? normalizeGrupoId(valor) : null },
  })
  revalidatePath("/rh/departamentos")
  return { ok: true }
}

export async function deleteDepartment(id: string): Promise<void> {
  await requireModuloEdit("DEPARTAMENTOS")
  await prisma.department.delete({ where: { id } })
  revalidatePath("/rh/departamentos")
}
