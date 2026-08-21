import {
  enderecoQuery,
  formatCep,
  isCepValido,
  temEnderecoGeocodificavel,
  type Coordenada,
  type EnderecoCampos,
} from "@/lib/geo/endereco"

// Geocodificação pelo Nominatim (OpenStreetMap). Sem chave e sem custo, em
// troca de duas obrigações da política de uso: no máximo 1 requisição por
// segundo e um User-Agent que identifique a aplicação. As duas estão cumpridas
// aqui — a fila serial abaixo é a única porta de saída para o Nominatim.
//
// NOMINATIM_URL permite apontar para uma instância própria (sem limite de
// taxa); NOMINATIM_CONTACT entra no User-Agent, como a política pede.

const BASE = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org"
const INTERVALO_MS = 1100

function userAgent(): string {
  const contato = process.env.NOMINATIM_CONTACT
  return `PortalPrev/1.0${contato ? ` (${contato})` : ""}`
}

// Fila serial em nível de módulo: cada chamada encadeia na anterior e só sai
// depois do intervalo mínimo. Vale por processo — é o suficiente, porque o
// portal roda numa instância só.
let ultimaChamada = 0
let corrente: Promise<unknown> = Promise.resolve()

function enfileirar<T>(fn: () => Promise<T>): Promise<T> {
  const proxima = corrente.then(async () => {
    const espera = INTERVALO_MS - (Date.now() - ultimaChamada)
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    ultimaChamada = Date.now()
    return fn()
  })
  // A fila não pode travar por causa de uma falha: o catch aqui só serve para
  // liberar o próximo da fila, o erro real segue para quem chamou.
  corrente = proxima.catch(() => {})
  return proxima
}

export type GeocodeResultado =
  | { status: "OK"; coordenada: Coordenada; displayName: string }
  | { status: "NAO_ENCONTRADO" }
  | { status: "ERRO"; error: string }

type NominatimItem = { lat?: string; lon?: string; display_name?: string }

async function consultar(params: URLSearchParams): Promise<NominatimItem[]> {
  params.set("format", "jsonv2")
  params.set("limit", "1")
  params.set("countrycodes", "br")
  params.set("addressdetails", "0")

  const res = await fetch(`${BASE}/search?${params.toString()}`, {
    headers: { "User-Agent": userAgent(), "Accept-Language": "pt-BR" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`)
  return (await res.json()) as NominatimItem[]
}

function primeiraCoordenada(itens: NominatimItem[]): GeocodeResultado | null {
  const item = itens[0]
  if (!item?.lat || !item?.lon) return null
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    status: "OK",
    coordenada: { lat, lng },
    displayName: item.display_name ?? "",
  }
}

/**
 * Duas tentativas, nesta ordem: consulta estruturada (mais precisa, mas exige
 * rua e cidade) e, se não achar, texto livre com o CEP junto. Cada tentativa
 * conta como uma requisição na fila — por isso a estruturada só roda quando
 * tem chance real de acertar.
 */
export async function geocodificarEndereco(
  e: EnderecoCampos & { textoLivre?: string | null }
): Promise<GeocodeResultado> {
  const textoLivre = e.textoLivre?.trim()
  if (!temEnderecoGeocodificavel(e) && !textoLivre) {
    return { status: "NAO_ENCONTRADO" }
  }

  try {
    if (e.logradouro?.trim() && e.cidade?.trim()) {
      const p = new URLSearchParams()
      p.set(
        "street",
        [e.numero?.trim(), e.logradouro.trim()].filter(Boolean).join(" ")
      )
      p.set("city", e.cidade.trim())
      if (e.uf?.trim()) p.set("state", e.uf.trim())
      if (isCepValido(e.cep)) p.set("postalcode", formatCep(e.cep))
      p.set("country", "Brasil")

      const achado = primeiraCoordenada(await enfileirar(() => consultar(p)))
      if (achado) return achado
    }

    const q = temEnderecoGeocodificavel(e)
      ? enderecoQuery(e)
      : `${textoLivre}, Brasil`
    const p = new URLSearchParams({ q })
    const achado = primeiraCoordenada(await enfileirar(() => consultar(p)))
    return achado ?? { status: "NAO_ENCONTRADO" }
  } catch (err) {
    return {
      status: "ERRO",
      error: err instanceof Error ? err.message : "Falha ao geocodificar.",
    }
  }
}
