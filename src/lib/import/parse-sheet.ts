import * as XLSX from "xlsx"

// Lê a primeira planilha de um arquivo .xlsx/.csv e retorna as linhas como objetos
// (chaveados pelo cabeçalho da primeira linha).
export async function parseSheet(
  file: File
): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  })
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

// Mapeia uma linha bruta para campos canônicos usando um dicionário de cabeçalhos.
export function mapRow(
  raw: Record<string, unknown>,
  headerMap: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const canonical = headerMap[normalizeKey(key)]
    if (canonical) out[canonical] = cellToString(value)
  }
  return out
}
