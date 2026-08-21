import Link from "next/link"

import {
  diaCurto,
  diaDaSemanaCurto,
  EFETIVO_PERIODOS,
  PERIODO_LABEL,
} from "@/lib/efetivo-cobertura"
import { Badge } from "@/components/ui/badge"

export type TurnoHistorico = {
  periodo: string
  total: number
  confirmado: boolean
}

export type DiaHistorico = {
  dateStr: string
  turnos: TurnoHistorico[]
}

/**
 * Histórico curto do posto: uma linha por dia com a contagem de cada turno.
 * É consulta agregada — a listagem completa continua sendo a tabela do dia, que
 * é para onde cada linha leva.
 */
export function EfetivoHistorico({
  departmentId,
  dias,
  esperados,
  hojeStr,
}: {
  departmentId: string
  dias: DiaHistorico[]
  esperados: string[]
  hojeStr: string
}) {
  const ausencias = dias.reduce(
    (n, d) =>
      n +
      d.turnos.filter(
        (t) => esperados.includes(t.periodo) && t.total === 0 && !t.confirmado
      ).length,
    0
  )

  return (
    <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <h2 className="text-base font-medium">Últimos {dias.length} dias</h2>
        <p className="text-sm text-muted-foreground">
          {ausencias > 0 ? (
            <>
              <span className="font-medium text-destructive">
                {ausencias} {ausencias === 1 ? "turno" : "turnos"}
              </span>{" "}
              sem cadastro no período. Clique no dia para abrir a listagem.
            </>
          ) : (
            "Clique no dia para abrir a listagem completa daquela data."
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left">
              <th className="py-2 pr-4 font-medium">Dia</th>
              {EFETIVO_PERIODOS.map((p) => (
                <th key={p} className="px-4 py-2 font-medium">
                  {PERIODO_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr
                key={d.dateStr}
                className="border-b border-foreground/5 last:border-0"
              >
                <td className="py-2 pr-4 whitespace-nowrap">
                  <Link
                    href={`/rh/efetivos/${departmentId}?date=${d.dateStr}`}
                    className="hover:underline"
                  >
                    <span
                      className={
                        d.dateStr === hojeStr ? "font-medium" : undefined
                      }
                    >
                      {diaCurto(d.dateStr)}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {d.dateStr === hojeStr
                        ? "hoje"
                        : diaDaSemanaCurto(d.dateStr)}
                    </span>
                  </Link>
                </td>
                {EFETIVO_PERIODOS.map((periodo) => {
                  const turno = d.turnos.find((t) => t.periodo === periodo)
                  return (
                    <td key={periodo} className="px-4 py-2">
                      <TurnoBadge
                        total={turno?.total ?? 0}
                        confirmado={turno?.confirmado ?? false}
                        esperado={esperados.includes(periodo)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TurnoBadge({
  total,
  confirmado,
  esperado,
}: {
  total: number
  confirmado: boolean
  esperado: boolean
}) {
  if (total > 0) {
    return (
      <Badge variant="secondary">
        {total} {total === 1 ? "pessoa" : "pessoas"}
      </Badge>
    )
  }
  // Ausência confirmada não é falha: alguém olhou e disse que o turno não tem
  // efetivo mesmo.
  if (confirmado) {
    return <Badge variant="outline">Sem efetivo (confirmado)</Badge>
  }
  if (!esperado) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return <Badge variant="destructive">Sem cadastro</Badge>
}
