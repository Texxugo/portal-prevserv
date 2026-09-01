import { competenciaLabel } from "@/lib/competencia"
import { formatDate } from "@/lib/format"
import { formatKm, kmTotalTurno } from "@/lib/relatorio/calculo"

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

// ---------- Relatório diário do posto ----------

export type RelatorioVeiculoMsg = {
  identificacao: string
  placa: string
  kmInicial: number | null
  kmFinal: number | null
  kmRodado: number | null
  kmProximaTroca: number | null
}

export type RelatorioEncomendaMsg = {
  destinatario: string
  quadraLote: string | null
  codigos: string
}

export type RelatorioItemMsg = {
  label: string
  valor: number | null
  status: string | null // OK | IRREGULAR | NAO_APLICA
  observacao: string | null
}

export type RelatorioVistoriaMsg = {
  tipo: string // OBRA | ESPACO
  titulo: string
  quadraLote: string | null
  endereco: string | null
  proprietario: string | null
  responsavel: string | null
  situacao: string | null // ANDAMENTO | PARADA
  apontamentos: string
  observacao: string | null
}

export type RelatorioDiarioInputMsg = {
  posto: string
  date: Date
  periodo: string
  responsavel: string | null
  encomendasProxTurno: number | null
  horaEncerramento: string | null
  postoPassadoPara: string | null
  observacoes: string | null
  veiculos: RelatorioVeiculoMsg[]
  encomendas: RelatorioEncomendaMsg[]
  estatisticas: RelatorioItemMsg[]
  portaria: RelatorioItemMsg[]
  vistorias: RelatorioVistoriaMsg[]
}

// "linha 1\nlinha 2" → ["- linha 1", "- linha 2"]; hífen já digitado é mantido.
function bullets(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("-") ? l : `- ${l}`))
}

function blocoVeiculos(i: RelatorioDiarioInputMsg): string[] {
  if (!i.veiculos.length) return []

  const trocas = i.veiculos
    .filter((v) => v.kmProximaTroca !== null)
    .map(
      (v) =>
        `- Próxima troca de óleo ${v.identificacao} placa ${v.placa} — KM ${formatKm(v.kmProximaTroca)}`
    )

  const detalhes = i.veiculos.flatMap((v) => [
    `${v.identificacao} — placa ${v.placa}`,
    `KM inicial: ${formatKm(v.kmInicial)}`,
    `KM final: ${formatKm(v.kmFinal)}`,
    ...(v.kmRodado !== null
      ? [`KM rodado no turno: ${formatKm(v.kmRodado)} km`]
      : []),
    "",
  ])

  const total =
    i.veiculos.filter((v) => v.kmRodado !== null).length > 1
      ? [`KM total do turno: ${formatKm(kmTotalTurno(i.veiculos))} km`]
      : []

  return [
    `VTRs — ${i.posto.toUpperCase()}`,
    "",
    ...trocas,
    ...(trocas.length ? [""] : []),
    ...detalhes,
    ...total,
  ]
}

function blocoEncomendas(i: RelatorioDiarioInputMsg): string[] {
  if (!i.encomendas.length && i.encomendasProxTurno === null) return []

  const cabecalho =
    i.encomendasProxTurno !== null
      ? [`ENCOMENDAS PASSADAS PARA O PRÓXIMO TURNO: ${i.encomendasProxTurno}`]
      : ["ENCOMENDAS"]

  const linhas = i.encomendas.flatMap((e) => {
    const codigos = e.codigos
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean)
    const titulo = [e.destinatario, e.quadraLote].filter(Boolean).join(" — ")
    // 1 código fica na mesma linha do nome; vários viram lista abaixo dele
    if (codigos.length <= 1) {
      return [[titulo, codigos[0]].filter(Boolean).join(": ")]
    }
    return [`${titulo}:`, ...codigos.map((c) => `  ${c}`)]
  })

  return [...cabecalho, "", ...linhas]
}

function blocoEstatistica(i: RelatorioDiarioInputMsg): string[] {
  const preenchidas = i.estatisticas.filter((e) => e.valor !== null)
  if (!preenchidas.length) return []
  return [
    "ESTATÍSTICA",
    "",
    ...preenchidas.map((e) => `${e.label}: ${e.valor}`),
  ]
}

function blocoPortaria(i: RelatorioDiarioInputMsg): string[] {
  const marcados = i.portaria.filter((p) => p.status || p.observacao)
  if (!marcados.length) return []

  const linhas = marcados.map((p) => {
    // Item conforme sai como "Ok"; irregular mostra o que foi encontrado.
    if (p.status === "NAO_APLICA") return `- ${p.label}: não se aplica`
    if (p.status === "OK") {
      return p.observacao ? `- ${p.label}: Ok — ${p.observacao}` : `- ${p.label}: Ok`
    }
    return `- ${p.label}: ${p.observacao || "irregular"}`
  })

  return [
    `CHECKLIST DA PORTARIA — ${i.periodo === "NOTURNO" ? "NOTURNO" : "DIURNO"}`,
    "",
    "Foi realizado o checklist da portaria, seguem as vistorias:",
    ...linhas,
  ]
}

function blocoVistoria(v: RelatorioVistoriaMsg): string[] {
  const identificacao = [
    v.proprietario ? `Proprietário: ${v.proprietario}` : null,
    v.endereco ? `Endereço: ${v.endereco}` : null,
    v.quadraLote ? `Quadra/Lote: ${v.quadraLote}` : null,
    v.responsavel ? `Vistoria realizada por: ${v.responsavel}` : null,
    v.situacao === "PARADA" ? "Situação: obra paralisada" : null,
    v.situacao === "ANDAMENTO" ? "Situação: obra em andamento" : null,
  ].filter((l): l is string => !!l)

  return [
    v.titulo.toUpperCase(),
    "",
    ...identificacao,
    ...(identificacao.length ? [""] : []),
    ...bullets(v.apontamentos),
    ...(v.observacao ? ["", `Observação: ${v.observacao}`] : []),
  ]
}

function blocoVistorias(i: RelatorioDiarioInputMsg, tipo: string, titulo: string): string[] {
  const doTipo = i.vistorias.filter((v) => v.tipo === tipo)
  if (!doTipo.length) return []
  return [titulo, "", ...doTipo.flatMap((v) => [...blocoVistoria(v), ""])]
}

// Nomes costumam vir digitados já com ponto final ("Keren Daiane G.") — sem
// isto a frase de encerramento fecharia com ponto duplicado.
function semPontoFinal(texto: string): string {
  return texto.trim().replace(/\.+$/, "")
}

function blocoEncerramento(i: RelatorioDiarioInputMsg): string[] {
  const fecho: string[] = []
  if (i.observacoes) fecho.push(i.observacoes)
  if (i.horaEncerramento) {
    const passagem = i.postoPassadoPara
      ? ` e passo o posto de trabalho para ${semPontoFinal(i.postoPassadoPara)}`
      : ""
    fecho.push(
      `Encerro o meu turno às ${i.horaEncerramento} horas sem mais nada a acrescentar${passagem}.`
    )
  }
  if (i.responsavel) fecho.push(`Por: ${semPontoFinal(i.responsavel)}.`)
  return fecho
}

// Texto do relatório diário para COLAR no grupo do posto. Sem markdown: sai
// exatamente como vai para o WhatsApp. Blocos sem dado preenchido são omitidos.
export function buildRelatorioDiarioMessage(i: RelatorioDiarioInputMsg): string {
  const blocos = [
    [
      `RELATÓRIO DIÁRIO — ${i.periodo === "NOTURNO" ? "NOTURNO" : "DIURNO"}`,
      "",
      `Posto: ${i.posto}`,
      `Data: ${formatDate(i.date)}`,
    ],
    blocoVeiculos(i),
    blocoEncomendas(i),
    blocoEstatistica(i),
    blocoPortaria(i),
    blocoVistorias(i, "OBRA", "VISTORIA DE OBRAS"),
    blocoVistorias(i, "ESPACO", "VISTORIA DE ESPAÇOS PÚBLICOS E MANUTENÇÃO"),
    blocoEncerramento(i),
  ].filter((b) => b.length > 0)

  return blocos
    .map((b) => b.join("\n").trim())
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
}

// Rodapé de autenticidade. Fica FORA do corpo do relatório de propósito: o
// corpo é editável e passa pela correção por IA, e nem a edição manual nem o
// modelo podem alterar ou remover o código. Ele é sempre anexado na hora de
// exibir/copiar, então vale para texto gerado e para texto reescrito à mão.
export function rodapeAutenticidade(codigo: string): string {
  return [
    "---",
    `Código de verificação: ${codigo}`,
    "Confira a autenticidade deste relatório no portal.",
  ].join("\n")
}

export function comRodapeAutenticidade(
  texto: string,
  codigo: string | null
): string {
  if (!codigo) return texto
  return `${texto.trimEnd()}\n\n${rodapeAutenticidade(codigo)}`
}

