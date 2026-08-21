import Link from "next/link"

import { requireModulo } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { filtroPostoId } from "@/lib/permissions"
import {
  COBERTURA_DIAS,
  diaCurto,
  diaDaSemanaCurto,
  diasAte,
  FREQUENCIA_MINIMA,
  horaDaJanela,
  inicioDaJanela,
  PERIODO_LABEL,
} from "@/lib/efetivo-cobertura"
import {
  carregarCobertura,
  carregarTurnosEsperados,
  turnoDe,
} from "@/lib/efetivo-cobertura-db"
import { formatDate, formatDateInput } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DateFilter } from "@/components/date-filter"
import { Badge } from "@/components/ui/badge"

const OPCOES_DIAS = [7, 15, 30]
const PADRAO_DIAS = 7

// Ausência de cadastro: dias em que o posto não registrou o efetivo de um turno
// que ele costuma registrar. É o oposto do lembrete — o lembrete cobra hoje,
// aqui fica o rastro do que passou sem cadastro.
export default async function AusenciasEfetivoPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; dias?: string }>
}) {
  const access = await requireModulo("EFETIVOS")

  const { date, dias: diasParam } = await searchParams
  const hojeStr = formatDateInput(new Date())
  const dateStr = date || hojeStr
  const quantidade = OPCOES_DIAS.includes(Number(diasParam))
    ? Number(diasParam)
    : PADRAO_DIAS

  const dias = diasAte(dateStr, quantidade)
  const agora = new Date()

  const [departments, cobertura, esperadosPorPosto] = await Promise.all([
    prisma.department.findMany({
      where: filtroPostoId(access),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    carregarCobertura(dias),
    carregarTurnosEsperados(dateStr),
  ])

  // Turno de hoje só é cobrado depois que a janela do lembrete abre: às 10h da
  // manhã ainda não faz sentido acusar o noturno de ausente.
  const janelaAberta = (dia: string, periodo: string) => {
    const hora = horaDaJanela(periodo)
    if (hora === null) return true
    return agora.getTime() >= inicioDaJanela(dia, hora).getTime()
  }

  const postos = departments
    .map((d) => {
      const esperados = esperadosPorPosto.get(d.id) ?? []
      const faltas = dias.flatMap((dia) =>
        esperados
          .filter((periodo) => {
            if (!janelaAberta(dia, periodo)) return false
            const turno = turnoDe(cobertura, d.id, dia, periodo)
            return turno.total === 0 && turno.confirmadoEm === null
          })
          .map((periodo) => ({ dia, periodo }))
      )
      return { ...d, esperados, faltas }
    })
    .filter((p) => p.faltas.length > 0)

  const total = postos.reduce((n, p) => n + p.faltas.length, 0)
  const semReferencia = departments.length - esperadosPorPosto.size

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ausências de cadastro"
        description={`Turnos sem efetivo lançado nos ${quantidade} dias até ${formatDate(new Date(dateStr))}.`}
      >
        <ButtonLink variant="outline" href="/rh/efetivos">
          Efetivos
        </ButtonLink>
        <DateFilter value={dateStr} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {OPCOES_DIAS.map((n) => (
          <ButtonLink
            key={n}
            size="sm"
            variant={n === quantidade ? "default" : "outline"}
            href={`/rh/efetivos/ausencias?date=${dateStr}&dias=${n}`}
          >
            {n} dias
          </ButtonLink>
        ))}
      </div>

      {postos.length === 0 ? (
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Nenhuma ausência no período. Todos os postos com turno regular
            lançaram o efetivo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium text-destructive">
              {total} {total === 1 ? "turno" : "turnos"}
            </span>{" "}
            sem cadastro em {postos.length}{" "}
            {postos.length === 1 ? "posto" : "postos"}.
          </p>

          <div className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {postos.map((p) => (
              <div key={p.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/rh/efetivos/${p.id}`}
                    className="font-medium uppercase hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    turno regular:{" "}
                    {p.esperados
                      .map((e) => PERIODO_LABEL[e]?.toLowerCase() ?? e)
                      .join(" e ")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.faltas.map((f) => (
                    <Link
                      key={`${f.dia}|${f.periodo}`}
                      href={`/rh/efetivos/${p.id}?date=${f.dia}`}
                      title={`Abrir ${p.name} em ${formatDate(new Date(f.dia))}`}
                    >
                      <Badge variant="destructive">
                        {diaCurto(f.dia)} {diaDaSemanaCurto(f.dia)} ·{" "}
                        {PERIODO_LABEL[f.periodo] ?? f.periodo}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Só é cobrado o turno que o posto registra na maior parte dos dias — pelo
        menos {Math.round(FREQUENCIA_MINIMA * 100)}% dos últimos {COBERTURA_DIAS}{" "}
        dias. Posto de evento, que não opera todo dia, fica de fora, e por isso{" "}
        {semReferencia} {semReferencia === 1 ? "posto" : "postos"} sem movimento
        recente {semReferencia === 1 ? "não é" : "não são"} cobrado
        {semReferencia === 1 ? "" : "s"}. Um turno confirmado como “sem efetivo”
        na tela do posto também sai desta lista.
      </p>
    </div>
  )
}
