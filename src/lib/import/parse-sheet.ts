import * as XLSX from "xlsx"

// Lê a primeira planilha de um arquivo .xls/.xlsx/.csv como matriz de strings já
// aparadas — sem assumir que a primeira linha é cabeçalho. O relatório de
// empregados vem agrupado por empresa, então quem interpreta é o importador.
export async function parseSheetRows(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true,
  })
  return rows.map((row) => row.map(cellToString))
}

// Normaliza um cabeçalho: minúsculas, sem acentos, sem espaços nas pontas.
export function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim()
}

// Converte um valor de célula em string utilizável.
export function cellToString(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, "0")
    const d = String(value.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return String(value).trim()
}
