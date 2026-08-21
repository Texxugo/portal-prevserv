// Cobertura do efetivo: quem já lançou o turno, quem ainda não conferiu e em
// que dias simplesmente não houve cadastro.
//
// Tudo aqui é função pura (sem Prisma, sem `server-only`) porque o badge de
// lembrete roda no cliente — o horário que importa é o do relógio de quem está
// olhando a tela, não o do servidor.

const DAY_MS = 86_400_000

export const EFETIVO_PERIODOS = ["DIURNO", "NOTURNO"] as const
export type EfetivoPeriodo = (typeof EFETIVO_PERIODOS)[number]

export const PERIODO_LABEL: Record<string, string> = {
  DIURNO: "Diurno",
  NOTURNO: "Noturno",
}

// Horários em que o efetivo do turno já deveria estar fechado. É quando o
// lembrete aparece pedindo conferência.
export const EFETIVO_JANELAS: { periodo: EfetivoPeriodo; hora: number }[] = [
  { periodo: "DIURNO", hora: 7 },
  { periodo: "NOTURNO", hora: 17 },
]

export function horaDaJanela(periodo: string): number | null {
  return EFETIVO_JANELAS.find((j) => j.periodo === periodo)?.hora ?? null
}

export function labelDaJanela(periodo: string): string {
  const hora = horaDaJanela(periodo)
  return hora === null ? "—" : `${String(hora).padStart(2, "0")}:00`
}

// Início da janela no fuso LOCAL de quem lê: "2026-08-11T07:00:00" sem sufixo Z
// é parseado como horário local, que é exatamente o que queremos.
export function inicioDaJanela(dateStr: string, hora: number): Date {
  return new Date(`${dateStr}T${String(hora).padStart(2, "0")}:00:00`)
}

export type EstadoTurno =
  | "FUTURO" // a janela do turno ainda não abriu
  | "SEM_CADASTRO" // janela aberta e nenhum efetivo lançado
  | "PENDENTE" // há cadastro, mas ninguém mexeu nem confirmou depois da janela
  | "CONFERIDO"

/**
 * Duas coisas calam o lembrete: um cadastro alterado depois que a janela abriu
 * (houve novidade e o posto lançou) ou uma confirmação explícita de que segue
 * sem novidades. Cadastro feito ANTES da janela não conta — a ideia do lembrete
 * é justamente forçar a conferência no horário.
 */
export function estadoDoTurno(input: {
  total: number
  atualizadoEm: Date | string | null
  confirmadoEm: Date | string | null
  inicioJanela: Date
  agora: Date
}): EstadoTurno {
  const { total, atualizadoEm, confirmadoEm, inicioJanela, agora } = input
  if (agora.getTime() < inicioJanela.getTime()) return "FUTURO"

  const depoisDaJanela = (d: Date | string | null) =>
    d !== null && new Date(d).getTime() >= inicioJanela.getTime()

  if (depoisDaJanela(confirmadoEm) || depoisDaJanela(atualizadoEm)) {
    return "CONFERIDO"
  }
  return total === 0 ? "SEM_CADASTRO" : "PENDENTE"
}

// ---------------------------------------------------------------------------
// Alerta de ausência
// ---------------------------------------------------------------------------

// Janela de referência para decidir se um posto opera aquele turno todo dia.
export const COBERTURA_DIAS = 30

// Posto de evento não trabalha todo dia; cobrar dele um cadastro diário encheria
// o painel de alerta falso. Só é cobrado o turno que o posto registra na maior
// parte dos dias.
export const FREQUENCIA_MINIMA = 0.6

/**
 * Turnos que se espera encontrar no posto todo dia, deduzidos do próprio
 * histórico — não há no schema nenhuma marcação de "posto 24h".
 */
export function turnosEsperados(
  registros: { date: string; periodo: string }[],
  diasNaJanela: number
): EfetivoPeriodo[] {
  const minimo = Math.ceil(diasNaJanela * FREQUENCIA_MINIMA)
  return EFETIVO_PERIODOS.filter((periodo) => {
    const dias = new Set(
      registros.filter((r) => r.periodo === periodo).map((r) => r.date)
    )
    return dias.size >= minimo
  })
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/** Últimos `quantidade` dias terminando em `fimStr`, do mais recente ao mais antigo. */
export function diasAte(fimStr: string, quantidade: number): string[] {
  // Aritmética em UTC: as datas do banco são "date-only" à meia-noite UTC e
  // somar 24h em horário local erraria o dia na virada do horário de verão.
  const fim = Date.parse(`${fimStr}T00:00:00Z`)
  if (Number.isNaN(fim)) return []
  return Array.from({ length: quantidade }, (_, i) =>
    new Date(fim - i * DAY_MS).toISOString().slice(0, 10)
  )
}

export function chaveTurno(dateStr: string, periodo: string): string {
  return `${dateStr}|${periodo}`
}

export function diaDaSemanaCurto(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${dateStr}T00:00:00Z`))
    .replace(".", "")
}

/** "11/08" — cabeçalho de coluna do painel de ausências. */
export function diaCurto(dateStr: string): string {
  const [, mes, dia] = dateStr.split("-")
  return `${dia}/${mes}`
}
