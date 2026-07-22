import { competenciaRange } from "../competencia"

export type EspelhoDia = { data: Date; marcacoes: string[] }
export type EspelhoColaborador = {
  matricula: string
  nome: string
  dias: EspelhoDia[]
}

// Decodifica tentando UTF-8; se aparecer caractere de substituição (arquivo latin1),
// refaz com windows-1252.
function decode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  if (!utf8.includes("�")) return utf8
  return new TextDecoder("windows-1252", { fatal: false }).decode(bytes)
}

// ---- Relatório "Marcações Agrupadas por Data" (blocos por colaborador, ano 2 díg) ----
const HEADER_RE = /Emp\.:\s*\d+\s+Matrícu\s*(\S+)\s+Nome:(.*)$/
const DAY_RE = /^\s*(\d{2})\/(\d{2})\/\d{2}(.*)$/

function parseAgrupadas(
  lines: string[],
  competencia: string
): EspelhoColaborador[] {
  const range = competenciaRange(competencia)
  const startMonth = range.start.getUTCMonth() + 1
  const startYear = range.start.getUTCFullYear()
  const endYear = range.end.getUTCFullYear()

  const result: EspelhoColaborador[] = []
  let current: EspelhoColaborador | null = null

  for (const line of lines) {
    const header = HEADER_RE.exec(line)
    if (header) {
      current = { matricula: header[1].trim(), nome: header[2].trim(), dias: [] }
      result.push(current)
      continue
    }
    const day = DAY_RE.exec(line)
    if (day && current) {
      const dd = parseInt(day[1], 10)
      const mm = parseInt(day[2], 10)
      const marcacoes = day[3].match(/\d{2}:\d{2}/g) ?? []
      const year = mm === startMonth ? startYear : endYear
      current.dias.push({ data: new Date(Date.UTC(year, mm - 1, dd)), marcacoes })
    }
  }
  return result
}

// ---- Relatório "Lista de Marcações Realizadas Simplificadas" (1 linha por colab+data,
// ano 4 díg, marcações com sufixo opcional "i") ----
// "   1144 1006     GIOVANA DE SOUZA E SILVA      21/05/2026 06:55 11:11 12:10 16:02"
//   grupo 1 = Emp. (empresa) | grupo 2 = matrícula
const SIMPLE_RE = /^\s*(\d+)\s+(\S+)\s+(.+?)\s+(\d{2})\/(\d{2})\/(\d{4})\s+(.*)$/

function parseSimplificado(lines: string[]): EspelhoColaborador[] {
  // A matrícula só é única DENTRO de cada empresa — empresas diferentes reusam o mesmo
  // número (ex.: 1144/545 KAIQUE e 1147/545 RAIMUNDO). Agrupa por empresa+matrícula para
  // não fundir pessoas distintas (senão a última linha sobrescreve as batidas da outra).
  const byKey = new Map<string, EspelhoColaborador>()
  const order: string[] = []

  for (const line of lines) {
    const m = SIMPLE_RE.exec(line)
    if (!m) continue
    const empresa = m[1].trim()
    const matricula = m[2].trim()
    const nome = m[3].trim()
    const dd = parseInt(m[4], 10)
    const mm = parseInt(m[5], 10)
    const yyyy = parseInt(m[6], 10)
    const marcacoes = m[7].match(/\d{2}:\d{2}/g) ?? [] // sufixo "i" é ignorado

    const chave = `${empresa}|${matricula}`
    let col = byKey.get(chave)
    if (!col) {
      col = { matricula, nome, dias: [] }
      byKey.set(chave, col)
      order.push(chave)
    }
    col.dias.push({ data: new Date(Date.UTC(yyyy, mm - 1, dd)), marcacoes })
  }

  return order.map((k) => byKey.get(k)!)
}

// Período coberto pelo relatório: menor e maior data listadas entre TODOS os colaboradores
// (dias listados contam mesmo sem marcações). Limita a detecção em arquivos parciais.
export function periodoDe(
  colaboradores: EspelhoColaborador[]
): { inicio: Date; fim: Date } | null {
  let min: Date | null = null
  let max: Date | null = null
  for (const c of colaboradores) {
    for (const d of c.dias) {
      if (!min || d.data.getTime() < min.getTime()) min = d.data
      if (!max || d.data.getTime() > max.getTime()) max = d.data
    }
  }
  return min && max ? { inicio: min, fim: max } : null
}

// Detecta automaticamente o formato do relatório do Qyon e delega ao parser certo.
export function parseQyonEspelho(
  buf: ArrayBuffer,
  competencia: string
): EspelhoColaborador[] {
  const text = decode(buf)
  const lines = text.split(/\r?\n/)
  if (/Simplificada/i.test(text)) {
    return parseSimplificado(lines)
  }
  return parseAgrupadas(lines, competencia)
}
