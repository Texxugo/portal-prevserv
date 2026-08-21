import { prisma } from "@/lib/db"
import { temEnderecoGeocodificavel } from "@/lib/geo/endereco"
import { geocodificarEndereco } from "@/lib/geo/nominatim"

// Grava o resultado da geocodificação. Todo endereço passa por aqui — nenhuma
// tela chama o Nominatim direto, para que o cache (lat/lng + geocodedAt) seja
// sempre respeitado e a fila de 1 req/s continue sendo a única saída.

export type GeocodeGravado = {
  ok: boolean
  lat?: number
  lng?: number
  status: "OK" | "NAO_ENCONTRADO" | "ERRO" | "SEM_ENDERECO"
  error?: string
}

const SEM_ENDERECO: GeocodeGravado = {
  ok: false,
  status: "SEM_ENDERECO",
  error: "Endereço incompleto: informe ao menos o CEP ou a rua e a cidade.",
}

type Alvo = {
  cep: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  endereco?: string | null
}

async function resolver(alvo: Alvo): Promise<GeocodeGravado> {
  if (!temEnderecoGeocodificavel(alvo) && !alvo.endereco?.trim()) {
    return SEM_ENDERECO
  }

  const r = await geocodificarEndereco({ ...alvo, textoLivre: alvo.endereco })
  if (r.status === "OK") {
    return { ok: true, status: "OK", lat: r.coordenada.lat, lng: r.coordenada.lng }
  }
  if (r.status === "NAO_ENCONTRADO") {
    return {
      ok: false,
      status: "NAO_ENCONTRADO",
      error: "Endereço não localizado no mapa. Confira rua, número e cidade.",
    }
  }
  return { ok: false, status: "ERRO", error: r.error }
}

export async function geocodificarDepartment(id: string): Promise<GeocodeGravado> {
  const dept = await prisma.department.findUnique({
    where: { id },
    select: {
      cep: true, logradouro: true, numero: true,
      bairro: true, cidade: true, uf: true,
    },
  })
  if (!dept) return { ok: false, status: "ERRO", error: "Posto não encontrado." }

  const r = await resolver(dept)
  if (r.status === "SEM_ENDERECO") return r

  await prisma.department.update({
    where: { id },
    data: {
      lat: r.ok ? r.lat : null,
      lng: r.ok ? r.lng : null,
      geocodedAt: new Date(),
      geocodeStatus: r.status,
    },
  })
  return r
}

export async function geocodificarEmployee(id: string): Promise<GeocodeGravado> {
  const emp = await prisma.employee.findUnique({
    where: { id },
    select: {
      cep: true, logradouro: true, numero: true,
      bairro: true, cidade: true, uf: true, endereco: true,
    },
  })
  if (!emp) return { ok: false, status: "ERRO", error: "Colaborador não encontrado." }

  const r = await resolver(emp)
  if (r.status === "SEM_ENDERECO") return r

  await prisma.employee.update({
    where: { id },
    data: {
      lat: r.ok ? r.lat : null,
      lng: r.ok ? r.lng : null,
      geocodedAt: new Date(),
      geocodeStatus: r.status,
    },
  })
  return r
}

export type LoteResultado = { processados: number; ok: number; falhas: number }

/**
 * Lote de quem ainda não tem coordenada. A 1 req/s do Nominatim é o limite
 * real: o padrão de 25 por rodada leva ~30 s, que é o teto do que dá para
 * segurar numa server action sem a tela parecer travada.
 *
 * Só entra quem nunca foi tentado ou quem falhou por erro de rede — endereço
 * dado como não encontrado fica de fora até alguém corrigir o cadastro, senão
 * a fila gastaria todas as rodadas repetindo os mesmos endereços ruins.
 */
export async function geocodificarPendentes(
  alvo: "POSTOS" | "COLABORADORES",
  limite = 25
): Promise<LoteResultado> {
  const pendente = {
    lat: null,
    OR: [{ geocodeStatus: null }, { geocodeStatus: "ERRO" }],
  }

  const saida: LoteResultado = { processados: 0, ok: 0, falhas: 0 }

  if (alvo === "POSTOS") {
    const ids = await prisma.department.findMany({
      where: pendente,
      select: { id: true },
      orderBy: { name: "asc" },
      take: limite,
    })
    for (const { id } of ids) {
      const r = await geocodificarDepartment(id)
      if (r.status === "SEM_ENDERECO") continue
      saida.processados++
      if (r.ok) saida.ok++
      else saida.falhas++
    }
    return saida
  }

  const ids = await prisma.employee.findMany({
    where: { ...pendente, status: "ATIVO" },
    select: { id: true },
    orderBy: { name: "asc" },
    take: limite,
  })
  for (const { id } of ids) {
    const r = await geocodificarEmployee(id)
    if (r.status === "SEM_ENDERECO") continue
    saida.processados++
    if (r.ok) saida.ok++
    else saida.falhas++
  }
  return saida
}

/** Quantos ainda esperam coordenada — alimenta o contador da tela de cadastro. */
export async function contarPendentesGeocode(): Promise<{
  postos: number
  colaboradores: number
}> {
  const semCoordenada = { lat: null }
  const [postos, colaboradores] = await Promise.all([
    prisma.department.count({
      where: { ...semCoordenada, OR: [{ cep: { not: null } }, { logradouro: { not: null } }] },
    }),
    prisma.employee.count({
      where: {
        ...semCoordenada,
        status: "ATIVO",
        OR: [{ cep: { not: null } }, { logradouro: { not: null } }, { endereco: { not: null } }],
      },
    }),
  ])
  return { postos, colaboradores }
}
