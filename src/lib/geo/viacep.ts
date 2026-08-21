import { normalizeCep } from "@/lib/geo/endereco"

// ViaCEP: CEP → logradouro/bairro/cidade/UF. Serviço público, sem chave e sem
// limite documentado. Só preenche o formulário — quem transforma em coordenada
// é o Nominatim (lib/geo/nominatim.ts).

export type ViaCepResultado = {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

type ViaCepResposta = {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

export async function buscarCep(
  cepBruto: string
): Promise<{ ok: true; endereco: ViaCepResultado } | { ok: false; error: string }> {
  const cep = normalizeCep(cepBruto)
  if (cep.length !== 8) return { ok: false, error: "CEP deve ter 8 dígitos." }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, error: `ViaCEP respondeu ${res.status}.` }

    const data = (await res.json()) as ViaCepResposta
    // CEP inexistente vem 200 com { erro: true } — não é erro de HTTP.
    if (data.erro) return { ok: false, error: "CEP não encontrado." }

    return {
      ok: true,
      endereco: {
        cep,
        logradouro: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        cidade: data.localidade ?? "",
        uf: data.uf ?? "",
      },
    }
  } catch {
    return { ok: false, error: "Não foi possível consultar o CEP agora." }
  }
}
