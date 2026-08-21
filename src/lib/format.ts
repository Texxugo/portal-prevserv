export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  // Datas são "date-only" armazenadas em UTC; formata em UTC para não deslocar o dia.
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(date)
  )
}

export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  return d.toISOString().slice(0, 10)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date))
}

// O cadastro guarda nome em CAIXA ALTA (vem assim da folha). Em mensagem para o
// colaborador isso soa como grito, então converte para caixa de título.
//
// Conectivos ficam minúsculos ("Luis Felipe dos Santos Ferreira", não "Dos
// Santos"), exceto quando abrem o nome. Partículas com apóstrofo ("D'Ávila") e
// hifenizadas ("Maria-Clara") mantêm a maiúscula depois do separador.
const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del", "van", "von", "y"])

function capitalizarParte(parte: string): string {
  return parte.replace(
    /[\p{L}][\p{L}\p{M}]*/gu,
    (p) => p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR")
  )
}

export function nomeProprio(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim().replace(/\s+/g, " ")
  if (!limpo) return ""

  return limpo
    .split(" ")
    .map((palavra, i) => {
      const minuscula = palavra.toLocaleLowerCase("pt-BR")
      if (i > 0 && CONECTIVOS.has(minuscula)) return minuscula
      return capitalizarParte(palavra)
    })
    .join(" ")
}

/** Primeiro nome, já em caixa de título — para o vocativo das mensagens. */
export function primeiroNome(nome: string | null | undefined): string {
  return nomeProprio(nome).split(" ")[0] ?? ""
}
