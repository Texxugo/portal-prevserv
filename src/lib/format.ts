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
