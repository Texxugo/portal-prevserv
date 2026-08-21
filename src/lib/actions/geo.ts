"use server"

import { revalidatePath } from "next/cache"

import { getAccess, requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import {
  contarPendentesGeocode,
  geocodificarDepartment,
  geocodificarEmployee,
  geocodificarPendentes,
  type LoteResultado,
} from "@/lib/geo/geocodificar"
import { normalizeCep } from "@/lib/geo/endereco"
import { buscarCep, type ViaCepResultado } from "@/lib/geo/viacep"
import { toFieldErrors, type FormState } from "@/lib/form"
import { podeVerPosto } from "@/lib/permissions"
import { departmentEnderecoSchema } from "@/lib/schemas"

// Endereço e coordenada. Separado de actions/rh.ts porque o mesmo par de
// operações (consultar CEP, geocodificar) serve a posto e a colaborador.

export async function consultarCep(cep: string): Promise<
  { ok: true; endereco: ViaCepResultado } | { ok: false; error: string }
> {
  // Só leitura, mas server action é endpoint: sem sessão não passa. A permissão
  // fina fica com quem grava o endereço.
  if (!(await getAccess())) return { ok: false, error: "Sessão expirada." }

  const cepLimpo = normalizeCep(cep)
  if (cepLimpo.length !== 8) return { ok: false, error: "CEP incompleto." }
  return buscarCep(cepLimpo)
}

export async function salvarEnderecoPosto(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireModuloEdit("DEPARTAMENTOS")
  const parsed = departmentEnderecoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const dados = {
    ...parsed.data,
    cep: parsed.data.cep ? normalizeCep(parsed.data.cep) : null,
    uf: parsed.data.uf?.toUpperCase() ?? null,
  }

  // Endereço novo invalida a coordenada antiga na mesma escrita: um alfinete
  // apontando para o endereço anterior é pior do que alfinete nenhum.
  await prisma.department.update({
    where: { id },
    data: { ...dados, lat: null, lng: null, geocodedAt: null, geocodeStatus: null },
  })

  const geo = await geocodificarDepartment(id)
  revalidatePath("/rh/departamentos")
  revalidatePath("/operacional")

  if (!geo.ok && geo.status !== "SEM_ENDERECO") {
    return { message: `Endereço salvo, mas não foi possível localizar no mapa: ${geo.error}` }
  }
  return { message: geo.ok ? "ok" : "Endereço salvo. Complete os dados para localizar no mapa." }
}

export async function geocodificarPostoAgora(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireModuloEdit("DEPARTAMENTOS")
  const r = await geocodificarDepartment(id)
  revalidatePath("/rh/departamentos")
  revalidatePath("/operacional")
  return { ok: r.ok, error: r.error }
}

export async function geocodificarColaboradorAgora(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireModuloEdit("COLABORADORES")
  const alvo = await prisma.employee.findUnique({
    where: { id },
    select: { departmentId: true },
  })
  if (!alvo || !podeVerPosto(user, alvo.departmentId)) {
    return { ok: false, error: "Este colaborador não está no seu acesso." }
  }
  const r = await geocodificarEmployee(id)
  revalidatePath("/rh")
  revalidatePath(`/rh/${id}`)
  revalidatePath("/operacional")
  return { ok: r.ok, error: r.error }
}

/**
 * Geocodificação em lote. O limite de 1 requisição por segundo do Nominatim
 * torna isso demorado de propósito: cada rodada trata poucos cadastros e a tela
 * chama de novo enquanto sobrar pendência.
 */
export async function geocodificarLote(
  alvo: "POSTOS" | "COLABORADORES"
): Promise<{ ok: boolean; resultado?: LoteResultado; pendentes?: number; error?: string }> {
  await requireModuloEdit(alvo === "POSTOS" ? "DEPARTAMENTOS" : "COLABORADORES")
  try {
    const resultado = await geocodificarPendentes(alvo)
    const pendentes = await contarPendentesGeocode()
    revalidatePath("/operacional")
    revalidatePath(alvo === "POSTOS" ? "/rh/departamentos" : "/rh")
    return {
      ok: true,
      resultado,
      pendentes: alvo === "POSTOS" ? pendentes.postos : pendentes.colaboradores,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha no lote." }
  }
}
