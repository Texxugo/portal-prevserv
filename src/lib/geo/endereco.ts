// Endereço estruturado — mesma forma para posto (Department) e colaborador
// (Employee). Função pura: roda no servidor e no cliente.

export type EnderecoCampos = {
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
}

export type Coordenada = { lat: number; lng: number }

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const

export function normalizeCep(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 8)
}

export function formatCep(raw: string | null | undefined): string {
  const d = normalizeCep(raw)
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function isCepValido(raw: string | null | undefined): boolean {
  return normalizeCep(raw).length === 8
}

/** Linha única para exibição. Vazio quando não há nada preenchido. */
export function enderecoResumo(e: EnderecoCampos): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ")
  const local = [e.bairro, e.cidade].filter(Boolean).join(" - ")
  const fim = [local, e.uf].filter(Boolean).join("/")
  return [rua, fim].filter(Boolean).join(", ")
}

/**
 * Um endereço só vale a pena geocodificar quando dá para chegar a um ponto:
 * ou tem CEP completo, ou tem rua + cidade. Bairro sozinho devolveria o
 * centroide do bairro e colocaria meia dúzia de pessoas no mesmo alfinete.
 */
export function temEnderecoGeocodificavel(e: EnderecoCampos): boolean {
  if (isCepValido(e.cep)) return true
  return !!(e.logradouro?.trim() && e.cidade?.trim())
}

/** Texto livre para a busca do Nominatim, quando não dá para usar a consulta estruturada. */
export function enderecoQuery(e: EnderecoCampos): string {
  const partes = [
    [e.logradouro, e.numero].filter(Boolean).join(", "),
    e.bairro,
    e.cidade,
    e.uf,
    formatCep(e.cep) || null,
    "Brasil",
  ].filter((p) => !!p && String(p).trim())
  return partes.join(", ")
}

/**
 * Duas coordenadas iguais empilham alfinetes e escondem gente no mapa. Como o
 * geocode por CEP devolve o mesmo ponto para todo mundo da mesma rua, o painel
 * espalha os repetidos num círculo pequeno (~20 m) em torno do ponto original.
 * O deslocamento é determinístico pelo índice — não "pula" a cada render.
 */
export function espalharCoincidentes<T extends Coordenada>(
  pontos: T[]
): (T & Coordenada)[] {
  const grupos = new Map<string, T[]>()
  for (const p of pontos) {
    const chave = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
    const lista = grupos.get(chave)
    if (lista) lista.push(p)
    else grupos.set(chave, [p])
  }

  const saida: (T & Coordenada)[] = []
  for (const lista of grupos.values()) {
    if (lista.length === 1) {
      saida.push(lista[0])
      continue
    }
    const raio = 0.0002 // ~22 m
    lista.forEach((p, i) => {
      const angulo = (2 * Math.PI * i) / lista.length
      saida.push({
        ...p,
        lat: p.lat + raio * Math.sin(angulo),
        lng:
          p.lng +
          (raio * Math.cos(angulo)) / Math.cos((p.lat * Math.PI) / 180),
      })
    })
  }
  return saida
}
