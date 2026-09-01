import { decodeTexto } from "../decode-texto"

// Import da planilha de apontamento exportada em TXT (colunas separadas por ";",
// uma linha por colaborador). As colunas são casadas pelo NOME no cabeçalho, e
// não pela posição, para o import não trocar os campos de lugar em silêncio se a
// exportação mudar a ordem das colunas.
//
// Colunas do arquivo sem campo equivalente no Apontamento ("Folgas" e "Períodos
// incompletos (PI)") são ignoradas.

export type ApontamentoTxtLinha = {
  nome: string
  total: number | null
  diasTrabalhados: number | null
  faltasJust: number | null
  faltasNJust: number | null
  dsr: number | null
  adicionalNoturno: number | null
  horasExtras: number | null
  vr: number | null
  intra: number | null
}

type Campo = keyof ApontamentoTxtLinha

export type ParseApontamentoTxt =
  | { ok: true; linhas: ApontamentoTxtLinha[] }
  | { ok: false; erro: string }

const ACCENTS = new RegExp("[\\u0300-\\u036f]", "g")

const norm = (s: string) =>
  s.normalize("NFD").replace(ACCENTS, "").toLowerCase().replace(/\s+/g, " ").trim()

// "HE" é o apelido que a planilha usa para horas extras — pelo mapeamento
// combinado, essa coluna alimenta o campo HE 50%.
const COLUNAS: { campo: Campo; casa: (h: string) => boolean }[] = [
  { campo: "nome", casa: (h) => h.startsWith("funcionario") || h === "nome" },
  { campo: "total", casa: (h) => h.startsWith("total previsto") || h === "total" },
  { campo: "diasTrabalhados", casa: (h) => h.startsWith("dias trabalhados") },
  { campo: "faltasJust", casa: (h) => h.startsWith("faltas c/") },
  { campo: "faltasNJust", casa: (h) => h.startsWith("faltas s/") },
  { campo: "dsr", casa: (h) => h.startsWith("dsr") },
  { campo: "adicionalNoturno", casa: (h) => h.startsWith("adicional noturno") },
  { campo: "horasExtras", casa: (h) => h.startsWith("horas extras") || h === "he" },
  { campo: "vr", casa: (h) => h.startsWith("vr") },
  { campo: "intra", casa: (h) => h.startsWith("intra") },
]

// Cabeçalho → posição de cada campo. Null quando a linha não parece um cabeçalho:
// sem a coluna do nome não há como saber de quem é a linha.
function mapearColunas(celulas: string[]): Map<Campo, number> | null {
  const mapa = new Map<Campo, number>()
  celulas.forEach((celula, i) => {
    const h = norm(celula)
    if (!h) return
    const col = COLUNAS.find((c) => !mapa.has(c.campo) && c.casa(h))
    if (col) mapa.set(col.campo, i)
  })
  return mapa.has("nome") ? mapa : null
}

// Aceita "7", "7,5" e "1.234,5"; devolve null para vazio ou lixo.
function toNum(s: string | undefined): number | null {
  const t = (s ?? "").trim()
  if (!t) return null
  const limpo = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

export function parseApontamentoTxt(buf: ArrayBuffer): ParseApontamentoTxt {
  const linhas: ApontamentoTxtLinha[] = []
  let mapa: Map<Campo, number> | null = null

  for (const raw of decodeTexto(buf).split(/\r?\n/)) {
    const linha = raw.trim()
    if (!linha || !linha.includes(";")) continue
    const celulas = linha.split(";").map((c) => c.trim())

    // Tudo que vier antes do cabeçalho (títulos, linhas em branco) é descartado.
    if (!mapa) {
      mapa = mapearColunas(celulas)
      continue
    }

    const cols = mapa
    const at = (campo: Campo) => {
      const i = cols.get(campo)
      return i === undefined ? undefined : celulas[i]
    }
    const nome = (at("nome") ?? "").trim()
    if (!nome) continue

    linhas.push({
      nome,
      total: toNum(at("total")),
      diasTrabalhados: toNum(at("diasTrabalhados")),
      faltasJust: toNum(at("faltasJust")),
      faltasNJust: toNum(at("faltasNJust")),
      dsr: toNum(at("dsr")),
      adicionalNoturno: toNum(at("adicionalNoturno")),
      horasExtras: toNum(at("horasExtras")),
      vr: toNum(at("vr")),
      intra: toNum(at("intra")),
    })
  }

  if (!mapa) {
    return {
      ok: false,
      erro:
        'Cabeçalho não encontrado. A primeira linha do arquivo precisa trazer os nomes das colunas separados por ";" (Funcionário;Total previsto;…).',
    }
  }
  if (linhas.length === 0) {
    return { ok: false, erro: "Nenhum colaborador encontrado no arquivo." }
  }
  return { ok: true, linhas }
}

// Horas decimais → duração "HH:MM" (formato dos campos he50/he100). Zero vira
// null: o DOCX só imprime a linha quando o campo está preenchido.
export function horasParaDuracao(horas: number | null): string | null {
  if (horas === null || !Number.isFinite(horas) || horas <= 0) return null
  const minutos = Math.round(horas * 60)
  const hh = Math.floor(minutos / 60)
  const mm = minutos % 60
  return `${hh}:${String(mm).padStart(2, "0")}`
}
