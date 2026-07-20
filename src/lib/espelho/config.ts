import { OCORRENCIA_LABEL } from "@/lib/espelho/detectar-fechamento"
import { getSetting } from "@/lib/settings"

// Configurações do espelho/fechamento gravadas em Setting.
// Leitura pura (sem sessão) — as actions de escrita ficam em lib/actions/fechamento.ts.

export const TOLERANCIA_KEY = "espelho_tolerancia_min"
export const TIPOS_ATIVOS_KEY = "espelho_tipos_ativos"
export const TODOS_TIPOS = Object.keys(OCORRENCIA_LABEL)

export async function getTolerancia(): Promise<number> {
  const s = await getSetting(TOLERANCIA_KEY)
  const n = s ? parseInt(s, 10) : NaN
  return isNaN(n) ? 10 : n
}

export async function getTiposAtivos(): Promise<Set<string>> {
  const s = await getSetting(TIPOS_ATIVOS_KEY)
  if (s === null) return new Set(TODOS_TIPOS)
  const list = s
    .split(",")
    .map((t) => t.trim())
    .filter((t) => TODOS_TIPOS.includes(t))
  return new Set(list)
}
