import type { DayResolver } from "./detectar-fechamento"
import type { EspelhoDia } from "./parse-qyon"

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

const dateKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`

const DAY_MS = 86_400_000

// Controle de virada: turno noturno que cruza a meia-noite (saída < entrada, ex.: 18:00 → 06:00).
// O relatório do Qyon pode separar a entrada (noite, dia X) da saída (manhã, dia X+1), fazendo
// cada dia parecer incompleto. Antes da detecção, juntamos as marcações que pertencem ao mesmo
// turno. O ponto médio entre a saída esperada e a próxima entrada separa uma saída atrasada da
// entrada do turno seguinte (em 18:00 → 06:00, o limite é 12:00).
export function aplicarVirada(
  dias: EspelhoDia[],
  resolveDay: DayResolver,
  inicioPeriodo?: Date | null
): EspelhoDia[] {
  const map = new Map<string, { data: Date; marcacoes: string[] }>()
  for (const d of dias) {
    map.set(dateKey(d.data), { data: d.data, marcacoes: [...d.marcacoes] })
  }

  // Borda da competência: a madrugada do 1º dia (21) pode pertencer à jornada noturna
  // iniciada na véspera (dia 20 — competência anterior, fora do arquivo). Essas marcações
  // já foram/serão tratadas no espelho anterior: descarta para não virar ocorrência aqui.
  if (inicioPeriodo) {
    const primeiro = map.get(dateKey(inicioPeriodo))
    if (primeiro && primeiro.marcacoes.length > 0) {
      const vespera = new Date(inicioPeriodo.getTime() - DAY_MS)
      if (!map.has(dateKey(vespera))) {
        const sched = resolveDay(vespera)
        if (sched?.entrada && sched?.saida) {
          const entrada = toMin(sched.entrada)
          const saida = toMin(sched.saida)
          if (saida < entrada) {
            const cutoff = Math.floor((saida + entrada) / 2)
            primeiro.marcacoes = primeiro.marcacoes.filter((m) => toMin(m) > cutoff)
          }
        }
      }
    }
  }

  // Candidatos a início de turno noturno: cada dia com batida + a véspera de cada dia com
  // batida. A véspera cobre o caso em que a ENTRADA da noite não foi batida (o dia da entrada
  // não aparece no arquivo, logo não está no map), mas a saída da madrugada seguinte existe e
  // pertence àquela noite — sem isso a saída ficaria órfã no dia seguinte e a noite viraria falta.
  const candidatos = new Map<string, Date>()
  for (const d of map.values()) {
    candidatos.set(dateKey(d.data), d.data)
    const vespera = new Date(d.data.getTime() - DAY_MS)
    candidatos.set(dateKey(vespera), vespera)
  }

  for (const k of [...candidatos.keys()].sort()) {
    const data = candidatos.get(k)!
    const sched = resolveDay(data)
    if (!sched?.entrada || !sched?.saida) continue
    const entrada = toMin(sched.entrada)
    const saida = toMin(sched.saida)
    if (saida >= entrada) continue // diurno: não vira a noite

    const next = map.get(dateKey(new Date(data.getTime() + DAY_MS)))
    if (!next || next.marcacoes.length === 0) continue

    // Entre a saída da manhã e a próxima entrada da noite existe uma janela de descanso.
    // O meio dessa janela é um limite estável mesmo quando a saída real passa da tolerância.
    const cutoff = Math.floor((saida + entrada) / 2)
    const saidaNoite = next.marcacoes.filter((m) => toMin(m) <= cutoff)
    if (saidaNoite.length === 0) continue

    // Se a entrada não foi batida, o dia da entrada ainda não existe no map — cria agora.
    const dia = map.get(k) ?? { data, marcacoes: [] as string[] }
    dia.marcacoes = [...dia.marcacoes, ...saidaNoite]
    map.set(k, dia)
    next.marcacoes = next.marcacoes.filter((m) => toMin(m) > cutoff)
  }

  return [...map.values()].map((v) => ({ data: v.data, marcacoes: v.marcacoes }))
}
