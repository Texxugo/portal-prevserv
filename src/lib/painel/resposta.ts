// Interpretação da resposta do colaborador no WhatsApp.
//
// Duas formas chegam pelo mesmo webhook: o id do botão, quando a conexão da
// Z-API suporta botões, e texto solto, quando não suporta (o convite sai com as
// opções numeradas). Função pura — dá para testar sem tocar em rede nem banco.

export const OPCAO_ACEITAR = "1"
export const OPCAO_RECUSAR = "2"
export const OPCAO_OPTOUT = "3"
export const OPCAO_DESLOCAMENTO_SIM = "d1"
export const OPCAO_DESLOCAMENTO_NAO = "d2"

export type RespostaConvite = "ACEITAR" | "RECUSAR" | "OPTOUT" | null
export type RespostaDeslocamento = "SIM" | "NAO" | null

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const contemAlgum = (t: string, frases: string[]) =>
  frases.some((f) => t.includes(f))

/**
 * Resposta ao convite. O id do botão manda; o texto é o plano B.
 *
 * A ordem dos testes importa: "não quero mais receber" contém "nao", e seria
 * lido como recusa se o opt-out não viesse antes.
 */
export function interpretarConvite(
  texto: string | null | undefined,
  botaoId?: string | null
): RespostaConvite {
  const id = (botaoId ?? "").trim()
  if (id === OPCAO_ACEITAR) return "ACEITAR"
  if (id === OPCAO_RECUSAR) return "RECUSAR"
  if (id === OPCAO_OPTOUT) return "OPTOUT"

  const t = normalizar(texto ?? "")
  if (!t) return null

  if (t === OPCAO_OPTOUT) return "OPTOUT"
  if (
    contemAlgum(t, [
      "nao receber",
      "nao quero mais",
      "nao me chame",
      "nao me chamem",
      "nao mande mais",
      "nao enviar mais",
      "parar de receber",
      "me tire da lista",
      "descadastrar",
      "sair da lista",
      "remover",
    ])
  ) {
    return "OPTOUT"
  }

  if (t === OPCAO_ACEITAR) return "ACEITAR"
  if (
    contemAlgum(t, ["aceito", "aceitar", "aceita", "topo", "pode contar", "quero sim", "vou sim", "confirmo"])
  ) {
    return "ACEITAR"
  }

  if (t === OPCAO_RECUSAR) return "RECUSAR"
  if (
    contemAlgum(t, ["recuso", "recusar", "nao posso", "nao consigo", "nao vou", "nao da", "infelizmente", "negativo"])
  ) {
    return "RECUSAR"
  }

  // Sim/não secos só valem depois das frases acima terem sido descartadas.
  if (t === "sim" || t === "s" || t === "ok" || t === "positivo") return "ACEITAR"
  if (t === "nao" || t === "n") return "RECUSAR"

  return null
}

/** Resposta à segunda pergunta: precisa de deslocamento? */
export function interpretarDeslocamento(
  texto: string | null | undefined,
  botaoId?: string | null
): RespostaDeslocamento {
  const id = (botaoId ?? "").trim()
  if (id === OPCAO_DESLOCAMENTO_SIM) return "SIM"
  if (id === OPCAO_DESLOCAMENTO_NAO) return "NAO"

  const t = normalizar(texto ?? "")
  if (!t) return null

  if (t === "1") return "SIM"
  if (t === "2") return "NAO"

  if (contemAlgum(t, ["nao preciso", "nao precisa", "tenho como ir", "vou por conta", "carro proprio", "tenho carro", "de moto"])) {
    return "NAO"
  }
  if (contemAlgum(t, ["preciso", "precisa", "sim", "buscar", "me busca", "carona", "transporte", "deslocamento"])) {
    return "SIM"
  }
  if (t === "nao" || t === "n") return "NAO"
  if (t === "s") return "SIM"

  return null
}
