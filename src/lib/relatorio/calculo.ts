// Helpers do controle de veículos do relatório diário.

// Placa é digitada a cada relatório (sem cadastro), então o casamento entre
// turnos ignora hífen, espaço e caixa: "frw-8d27" e "FRW8D27" são a mesma VTR.
export function normalizePlaca(placa: string): string {
  return placa.replace(/[^a-z0-9]/gi, "").toUpperCase()
}

// KM chega do formulário em formato BR ("159.008") ou solto ("159008").
export function parseKm(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.trunc(raw) : null
  const digits = raw.replace(/[^\d]/g, "")
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return "—"
  return new Intl.NumberFormat("pt-BR").format(km)
}

// Odômetro só anda para frente: KM final menor que o inicial é erro de
// digitação, não rodagem negativa — nesse caso não há quilometragem a apurar.
export function kmRodado(
  kmInicial: number | null | undefined,
  kmFinal: number | null | undefined
): number | null {
  if (kmInicial === null || kmInicial === undefined) return null
  if (kmFinal === null || kmFinal === undefined) return null
  const diff = kmFinal - kmInicial
  return diff >= 0 ? diff : null
}

export type VeiculoCalc = {
  identificacao: string
  placa: string
  kmInicial: number | null
  kmFinal: number | null
  kmRodado: number | null
  kmProximaTroca: number | null
}

// Soma do turno: só entram VTRs com rodagem apurada.
export function kmTotalTurno(veiculos: { kmRodado: number | null }[]): number {
  return veiculos.reduce((total, v) => total + (v.kmRodado ?? 0), 0)
}

// Quanto falta para a próxima troca de óleo (negativo = já passou do ponto).
export function kmAteTroca(
  kmFinal: number | null | undefined,
  kmProximaTroca: number | null | undefined
): number | null {
  if (kmFinal === null || kmFinal === undefined) return null
  if (kmProximaTroca === null || kmProximaTroca === undefined) return null
  return kmProximaTroca - kmFinal
}
