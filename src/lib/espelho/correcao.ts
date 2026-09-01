import { readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from "docx"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { blocoAleatorio } from "@/lib/codigo"
import { competenciaLabel } from "@/lib/competencia"
import { formatDate, formatDateTime } from "@/lib/format"
import { formatCpf } from "@/lib/import/empregados"
import { SCHEDULE_FIELDS, type DaySchedule } from "@/lib/jornada"

// Declaração de marcação de ponto — o papel que sai da ocorrência "Marcação
// incompleta". Imprime em A4, mas o conteúdo todo cabe na METADE DE CIMA da
// folha: dá para cortar ao meio depois de assinar, sem sobrar papel em branco.
// Timbre à esquerda, uma frase, os horários que faltaram e o motivo em linha, e
// duas assinaturas. Tudo que é do sistema (código, competência, matrícula, quem
// emitiu) vai para o rodapé, fora do caminho de quem só preenche e assina.
//
// DOCX e PDF são duas impressões do MESMO conteúdo: os textos abaixo são a
// fonte única dos dois renderizadores, para as versões não divergirem.

// Código do documento: "CP-2108-7K3F9". O primeiro grupo é o dia/mês que está
// sendo corrigido — quem tem o papel na mão confere na hora se ele fala da data
// que diz falar. O segundo é sorteado (ver blocoAleatorio).
const GRUPO = 5

export function gerarCodigoCorrecao(data: Date): string {
  const dd = String(data.getUTCDate()).padStart(2, "0")
  const mm = String(data.getUTCMonth() + 1).padStart(2, "0")
  return `CP-${dd}${mm}-${blocoAleatorio(GRUPO)}`
}

// Quantos horários o papel precisa pedir: o que a jornada daquele dia espera
// menos o que o relógio registrou. Sem jornada cadastrada, assume o dia cheio de
// 4 batidas. Nunca menos de 1 — a ocorrência só existe porque faltou alguma.
export function contarCamposFaltantes(
  marcacoes: string,
  sched: DaySchedule | null
): number {
  const esperadas = sched ? SCHEDULE_FIELDS.filter((f) => sched[f.key]).length : 4
  const realizadas = marcacoes.split(/\s+/).filter(Boolean).length
  return Math.max(1, esperadas - realizadas)
}

export type CorrecaoDoc = {
  codigo: string
  employeeName: string
  cpf: string | null
  matricula: string | null
  empresa: string | null
  competencia: string
  /** Dia a corrigir (date-only em UTC). */
  data: Date
  /** Batidas que o relógio registrou no dia, como estavam na emissão. */
  marcacoes: string
  /** Detalhe da ocorrência, ex.: "Marcação incompleta (3 batidas)". */
  detalhe: string
  /** Quantos horários o papel pede à mão (ver contarCamposFaltantes). */
  camposFaltantes: number
  emitidoPor: string
  emitidoEm: Date
}

const TITULO = "DECLARAÇÃO DE MARCAÇÃO DE PONTO"
const BRANCO = "____________"

// Timbre do cabeçalho. Sem o arquivo, o documento sai sem logo em vez de a
// emissão falhar — o papel vale pelo código, não pela imagem.
const LOGO_ARQUIVO = join(process.cwd(), "public", "logo-prevserv.png")
const LOGO_PROPORCAO = 145 / 480
const LOGO_LARGURA = 90 // pt

let logoCache: Uint8Array | null | undefined

async function carregarLogo(): Promise<Uint8Array | null> {
  if (logoCache === undefined) {
    try {
      logoCache = new Uint8Array(await readFile(LOGO_ARQUIVO))
    } catch {
      logoCache = null
    }
  }
  return logoCache
}

// Os dois campos de preenchimento saem em LINHA, não em lista nem tabela: quem
// preenche lê rótulo e branco na mesma varrida, e o papel não vira formulário.
//
// Só os horários que faltaram viram branco: a jornada do dia diz quantas batidas
// eram esperadas, o relógio diz quantas saíram, a diferença é o que se escreve à
// mão. Com 3 de 4 batidas, sai um branco só — e aí nem numeração precisa.
function linhaHorarios(quantidade: number): string {
  if (quantidade <= 1) return `Horário que faltou:   ${BRANCO}`
  const brancos = Array.from(
    { length: quantidade },
    (_, i) => `${i + 1}ª ${BRANCO}`
  ).join("   ")
  return `Horários que faltaram:   ${brancos}`
}

const CAIXA = "(   )"
const MOTIVO_LINHA = [
  "Motivo:",
  ...["Esquecimento de marcação", "Falha no equipamento/sistema", `Outro: ${BRANCO}`].map(
    (m) => `${CAIXA} ${m}`
  ),
].join("   ")

const ASSINATURAS = ["Colaborador", "Líder responsável"]
const RISCO = "____________________________"

function corpo(doc: CorrecaoDoc): string {
  const cpf = doc.cpf ? `, CPF ${formatCpf(doc.cpf) ?? doc.cpf}` : ""
  // "Marcação incompleta (3 batidas)" entra no meio da frase — minúscula só na
  // primeira letra, para não estragar siglas que venham no detalhe.
  const ocorrencia = doc.detalhe
    ? doc.detalhe.charAt(0).toLocaleLowerCase("pt-BR") + doc.detalhe.slice(1)
    : "marcação incompleta"
  const batidas = doc.marcacoes.trim()
  const registro = batidas
    ? `o relógio registrou ${batidas}`
    : "o relógio não registrou nenhuma batida"
  const faltou =
    doc.camposFaltantes <= 1
      ? "A marcação que faltou está indicada abaixo"
      : "As marcações que faltaram estão indicadas abaixo"

  return (
    `Eu, ${doc.employeeName}${cpf}, declaro que no dia ${formatDate(doc.data)} ` +
    `houve ${ocorrencia}: ${registro}. ${faltou} e solicito o ajuste do meu ` +
    "registro de ponto."
  )
}

// Só o que é rastreabilidade mora aqui embaixo, numa linha só.
function rodape(doc: CorrecaoDoc): string {
  const partes = [
    doc.codigo,
    competenciaLabel(doc.competencia),
    doc.matricula ? `matrícula ${doc.matricula}` : null,
    doc.empresa,
    `emitido por ${doc.emitidoPor} em ${formatDateTime(doc.emitidoEm)}`,
  ]
  return partes.filter(Boolean).join(" · ")
}

/** Nome do arquivo baixado, já sem caracteres que o Windows recusa. */
export function nomeArquivoCorrecao(doc: CorrecaoDoc, ext: "docx" | "pdf"): string {
  const nome = doc.employeeName
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // tira os acentos que o NFD separou
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return `correcao-ponto-${doc.codigo}-${nome}.${ext}`
}

// ---- DOCX ----

const VERDE = "1B7A45"
const NENHUMA = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const SEM_BORDA = {
  top: NENHUMA,
  bottom: NENHUMA,
  left: NENHUMA,
  right: NENHUMA,
  insideHorizontal: NENHUMA,
  insideVertical: NENHUMA,
}

function linha(value: string, size: number, opts: { after?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 0 },
    children: [new TextRun({ text: value, size })],
  })
}

function centrado(value: string, size: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: value, size })],
  })
}

async function cabecalhoDocx(): Promise<Table> {
  const logo = await carregarLogo()
  const largura = 120 // px (≈90pt a 96dpi)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SEM_BORDA,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              logo
                ? new Paragraph({
                    children: [
                      new ImageRun({
                        type: "png",
                        data: logo,
                        transformation: {
                          width: largura,
                          height: Math.round(largura * LOGO_PROPORCAO),
                        },
                        altText: {
                          name: "Logo",
                          title: "Grupo Prevserv",
                          description: "Logotipo do Grupo Prevserv",
                        },
                      }),
                    ],
                  })
                : new Paragraph({ text: "" }),
            ],
            width: { size: 45, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: TITULO, bold: true, size: 26 })],
              }),
            ],
            width: { size: 55, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  })
}

export async function docxCorrecao(doc: CorrecaoDoc): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [
    await cabecalhoDocx(),
    new Paragraph({
      spacing: { before: 80, after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: VERDE, space: 4 } },
      children: [new TextRun({ text: "", size: 2 })],
    }),

    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 400, line: 300 },
      children: [new TextRun({ text: corpo(doc), size: 20 })],
    }),

    linha(linhaHorarios(doc.camposFaltantes), 20, { after: 260 }),
    linha(MOTIVO_LINHA, 19, { after: 1600 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: SEM_BORDA,
      rows: [
        new TableRow({
          children: ASSINATURAS.map(
            (label) =>
              new TableCell({
                children: [centrado(RISCO, 20), centrado(label, 16)],
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: { top: 40, bottom: 40, left: 40, right: 40 },
              })
          ),
        }),
      ],
    }),

    new Paragraph({
      spacing: { before: 900 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 6 } },
      children: [new TextRun({ text: rodape(doc), size: 15, color: "666666" })],
    }),
  ]

  const buf = await Packer.toBuffer(
    new Document({
      sections: [
        {
          properties: {
            // A4 com a margem de baixo comendo a metade inferior: o Word não
            // deixa o texto passar do meio da folha, que é onde ela é cortada.
            page: {
              size: {
                width: convertMillimetersToTwip(210),
                height: convertMillimetersToTwip(297),
              },
              margin: {
                top: 1080,
                right: 960,
                bottom: convertMillimetersToTwip(297) / 2,
                left: 960,
              },
            },
          },
          children,
        },
      ],
    })
  )
  return new Uint8Array(buf)
}

// ---- PDF ----

// Folha A4 inteira, conteúdo confinado à metade de cima (METADE é onde a folha
// é cortada depois de assinada).
const A4 = { largura: 595.28, altura: 841.89 }
const METADE = A4.altura / 2
const MARGEM = 48

export async function pdfCorrecao(doc: CorrecaoDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([A4.largura, A4.altura])
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  const preto = rgb(0.1, 0.1, 0.1)
  const cinza = rgb(0.45, 0.45, 0.45)
  const clara = rgb(0.75, 0.75, 0.75)
  const verde = rgb(0.106, 0.478, 0.271)
  const util = A4.largura - MARGEM * 2

  pdf.setTitle(`${TITULO} ${doc.codigo}`)
  pdf.setSubject(doc.employeeName)
  // O código também vive nos metadados: um PDF reencaminhado continua rastreável
  // mesmo que só o arquivo chegue ao RH.
  pdf.setKeywords([doc.codigo, doc.competencia])

  const escrever = (
    value: string,
    y: number,
    opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}
  ) =>
    page.drawText(value, {
      x: opts.x ?? MARGEM,
      y,
      size: opts.size ?? 10,
      font: opts.bold ? negrito : normal,
      color: opts.color ?? preto,
    })

  // Cabeçalho: timbre à esquerda, título à direita, régua verde embaixo
  const logo = await carregarLogo()
  const alturaLogo = LOGO_LARGURA * LOGO_PROPORCAO
  let y = A4.altura - MARGEM - alturaLogo

  if (logo) {
    page.drawImage(await pdf.embedPng(logo), {
      x: MARGEM,
      y,
      width: LOGO_LARGURA,
      height: alturaLogo,
    })
  }
  escrever(TITULO, y + alturaLogo / 2 - 4.5, {
    x: A4.largura - MARGEM - negrito.widthOfTextAtSize(TITULO, 13),
    size: 13,
    bold: true,
  })

  y -= 12
  page.drawLine({
    start: { x: MARGEM, y },
    end: { x: A4.largura - MARGEM, y },
    thickness: 1,
    color: verde,
  })

  // Texto corrido
  y -= 28
  for (const trecho of quebrar(corpo(doc), normal, 10, util)) {
    escrever(trecho, y)
    y -= 15
  }

  // Horários que faltaram e motivo — uma linha cada
  y -= 16
  escrever(linhaHorarios(doc.camposFaltantes), y)

  y -= 26
  for (const trecho of quebrar(MOTIVO_LINHA, normal, 10, util)) {
    escrever(trecho, y)
    y -= 15
  }

  // Assinaturas e rodapé ancorados na METADE da folha: é ali que ela é cortada,
  // e o miolo pode crescer (1 ou 3 brancos) sem empurrar nada para baixo.
  const yRodapeBase = METADE + 10
  y = Math.max(yRodapeBase + 62, Math.min(y - 40, METADE + 96))
  const larguraAss = util / ASSINATURAS.length
  ASSINATURAS.forEach((label, i) => {
    const centro = MARGEM + i * larguraAss + larguraAss / 2
    page.drawLine({
      start: { x: centro - 85, y },
      end: { x: centro + 85, y },
      thickness: 0.8,
      color: preto,
    })
    escrever(label, y - 12, {
      x: centro - normal.widthOfTextAtSize(label, 8) / 2,
      size: 8,
      color: cinza,
    })
  })

  const linhasRodape = quebrar(rodape(doc), normal, 7, util)
  let yRodape = yRodapeBase + (linhasRodape.length - 1) * 9
  page.drawLine({
    start: { x: MARGEM, y: yRodape + 11 },
    end: { x: A4.largura - MARGEM, y: yRodape + 11 },
    thickness: 0.5,
    color: clara,
  })
  for (const trecho of linhasRodape) {
    escrever(trecho, yRodape, { size: 7, color: cinza })
    yRodape -= 9
  }

  return pdf.save()
}

// pdf-lib não quebra linha sozinho: mede palavra a palavra e devolve as linhas.
function quebrar(
  texto: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  largura: number
): string[] {
  const linhas: string[] = []
  let atual = ""
  for (const palavra of texto.split(" ")) {
    const teste = atual ? `${atual} ${palavra}` : palavra
    if (font.widthOfTextAtSize(teste, size) > largura && atual) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = teste
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}
