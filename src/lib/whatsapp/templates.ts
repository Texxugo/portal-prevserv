import { competenciaLabel } from "@/lib/competencia"

// Textos-modelo das mensagens de WhatsApp enviadas ao COLABORADOR.
// Esqueleto único: saudação + corpo específico + pedido + fecho padrão + despedida.
// A mensagem interna de cobrança ao RH (lib/notificacoes/cobranca.ts) tem
// finalidade distinta e não usa este esqueleto.

const FECHO = "Em caso de dúvida, estamos à disposição neste contato."

export function buildColaboradorMessage(input: {
  nome: string
  corpo: string
  pedido: string
}): string {
  return `Olá, ${input.nome}!\n\n${input.corpo}\n\n${input.pedido} ${FECHO}\n\nObrigado!`
}

export type EspelhoDiaMsg = {
  data: string
  tipo: string
  marcacoes: string[]
}

// Aviso de pendências de marcação no espelho de ponto.
export function buildEspelhoMessage(input: {
  nome: string
  competencia: string
  dias: EspelhoDiaMsg[]
}): string {
  const linhas = input.dias
    .map((d) => {
      const marc = d.marcacoes.join("  ")
      return `• ${d.data}: ${d.tipo}${marc ? ` (${marc})` : ""}`
    })
    .join("\n")
  return buildColaboradorMessage({
    nome: input.nome,
    corpo: `Identificamos pendências no seu ponto na competência ${competenciaLabel(input.competencia)}:\n${linhas}`,
    pedido: "Por favor, regularize sua marcação ou apresente a justificativa.",
  })
}

// Solicitação de documento de uma pendência documental.
export function buildDocumentoMessage(input: {
  employeeName: string
  documentType: string
  competencia: string
  reason: string
}): string {
  const motivo = input.reason.trim() ? `\n\nMotivo: ${input.reason.trim()}` : ""
  return buildColaboradorMessage({
    nome: input.employeeName,
    corpo: `Precisamos do documento "${input.documentType}" referente à competência ${competenciaLabel(input.competencia)}.${motivo}`,
    pedido: "Por favor, envie o documento por este contato.",
  })
}
