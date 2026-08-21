// Situação do colaborador no dia — é o que a lista lateral do painel mostra ao
// lado do nome e o que decide quem vale a pena convocar para um extra.
// Função pura: o painel recalcula no cliente quando muda a data em foco.

export const SITUACOES = [
  "NO_POSTO",
  "ESCALADO",
  "FOLGA",
  "SEM_ESCALA",
  "AFASTADO",
] as const

export type Situacao = (typeof SITUACOES)[number]

export const SITUACAO_LABEL: Record<Situacao, string> = {
  NO_POSTO: "Em serviço",
  ESCALADO: "Escalado hoje",
  FOLGA: "De folga",
  SEM_ESCALA: "Sem escala",
  AFASTADO: "Afastado",
}

export const SITUACAO_DESCRICAO: Record<Situacao, string> = {
  NO_POSTO: "Já lançado no efetivo de hoje.",
  ESCALADO: "A escala prevê trabalho hoje, mas ainda não consta no efetivo.",
  FOLGA: "A escala não prevê trabalho hoje — melhor candidato para o extra.",
  SEM_ESCALA: "Sem escala cadastrada: a disponibilidade precisa ser confirmada.",
  AFASTADO: "Férias, afastamento ou cadastro inativo — não convocar.",
}

/** Ordem em que a lista lateral apresenta: quem pode cobrir primeiro. */
export const SITUACAO_PRIORIDADE: Record<Situacao, number> = {
  FOLGA: 0,
  SEM_ESCALA: 1,
  ESCALADO: 2,
  NO_POSTO: 3,
  AFASTADO: 4,
}

/** Quem o painel considera convocável. Afastado e já em serviço ficam de fora. */
export function podeSerConvocado(s: Situacao): boolean {
  return s === "FOLGA" || s === "SEM_ESCALA" || s === "ESCALADO"
}

export type SituacaoEntrada = {
  status: string // ATIVO | INATIVO | AFASTADO
  noEfetivoHoje: boolean
  temMovimentoAfastando: boolean
  temEscala: boolean
  escaladoHoje: boolean
}

/**
 * A ordem dos testes é a regra de negócio: um afastamento vale mais que
 * qualquer escala (a escala não sabe que a pessoa está de férias), e estar no
 * efetivo vale mais que a escala prevista (o efetivo é o que de fato aconteceu).
 */
export function situacaoDoDia(e: SituacaoEntrada): Situacao {
  if (e.status !== "ATIVO" || e.temMovimentoAfastando) return "AFASTADO"
  if (e.noEfetivoHoje) return "NO_POSTO"
  if (!e.temEscala) return "SEM_ESCALA"
  return e.escaladoHoje ? "ESCALADO" : "FOLGA"
}

// ---------- Referência visual do alfinete ----------

export type Sexo = "M" | "F"

export function isSexo(v: string | null | undefined): v is Sexo {
  return v === "M" || v === "F"
}

export const SEXO_LABEL: Record<Sexo, string> = {
  M: "Masculino",
  F: "Feminino",
}

// Razão social da vigilância. Quem está registrado nela pode assumir posto de
// vigilante; os demais, não. O painel marca isso no alfinete porque é o
// primeiro filtro de quem serve para a cobertura.
export const EMPRESA_SANTO_PREFIXO = "SANTO E BUENO"

export function temRegistroSanto(empresa: string | null | undefined): boolean {
  return (empresa ?? "").trim().toUpperCase().startsWith(EMPRESA_SANTO_PREFIXO)
}
