import { competenciaLabel } from "@/lib/competencia"
import { formatDate } from "@/lib/format"

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

export type EfetivoGrupoLinha = {
  nome: string
  local: string | null // função/posição: "Portaria social", "Limpeza"…
  horario: string | null // "06:00 - 18:00" (formato gravado)
  freelancer: boolean
}

export type EfetivoGrupoInput = {
  posto: string
  date: Date
  periodo: string // DIURNO | NOTURNO
  baseOperacional: string[] // alocados vindos do posto BASE
  linhas: EfetivoGrupoLinha[]
}

// "06:00" → "06h" · "07:30" → "07h30"
function formatHora(hhmm: string): string {
  const [h, m] = hhmm.split(":")
  return m === "00" ? `${h}h` : `${h}h${m}`
}

// "06:00 - 18:00" → "06h às 18h". Texto legado fora do padrão passa intacto.
function formatHorario(horario: string | null): string | null {
  if (!horario) return null
  const partes = horario.split("-").map((p) => p.trim())
  if (partes.length === 2 && partes.every((p) => /^\d{2}:\d{2}$/.test(p))) {
    return `${formatHora(partes[0])} às ${formatHora(partes[1])}`
  }
  return horario
}

const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e"])

// Cadastro vem em CAIXA ALTA (importação); no grupo fica melhor capitalizado.
// Nome já digitado com maiúscula/minúscula é preservado.
function formatNome(nome: string): string {
  if (nome !== nome.toUpperCase()) return nome
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((p, i) =>
      i > 0 && CONECTIVOS.has(p)
        ? p
        : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)
    )
    .join(" ")
}

// Efetivo do dia para COLAR nos grupos de WhatsApp (não é envio Z-API ao
// colaborador, por isso não usa o esqueleto acima). Sem markdown: o texto sai
// exatamente como vai para o grupo.
export function buildEfetivoGrupoMessage(i: EfetivoGrupoInput): string {
  const cabecalho = [
    `EFETIVO ${i.periodo === "NOTURNO" ? "NOTURNO" : "DIURNO"}`,
    "",
    `Posto: ${i.posto}`,
    `Data: ${formatDate(i.date)}`,
    ...(i.baseOperacional.length
      ? [`Base operacional: ${i.baseOperacional.map(formatNome).join(", ")}`]
      : []),
  ]

  const linhas = i.linhas.map((l) => {
    const detalhes = [
      formatHorario(l.horario),
      l.freelancer ? "freelancer" : null,
    ].filter((d): d is string => !!d)
    const pessoa = [formatNome(l.nome), ...detalhes].join(" – ")
    return l.local ? `${l.local}: ${pessoa}` : pessoa
  })

  return [...cabecalho, "", ...linhas].join("\n")
}
