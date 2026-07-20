"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import {
  FechamentoTable,
  type FechamentoRow,
} from "@/components/rh/fechamento-table"

type Filtro = "ABERTO" | "EM_ANALISE" | "ENCERRADO" | "FALTA" | null

export function FechamentoBoard({
  data,
  competencia,
  canEdit,
}: {
  data: FechamentoRow[]
  competencia: string
  canEdit: boolean
}) {
  const [filtro, setFiltro] = useState<Filtro>(null)

  const counters: { key: Filtro; label: string; value: number }[] = [
    { key: "ABERTO", label: "Abertos", value: data.filter((f) => f.status === "ABERTO").length },
    { key: "EM_ANALISE", label: "Em análise", value: data.filter((f) => f.status === "EM_ANALISE").length },
    { key: "ENCERRADO", label: "Encerrados", value: data.filter((f) => f.status === "ENCERRADO").length },
    { key: "FALTA", label: "Com falta", value: data.filter((f) => f.hasFalta).length },
  ]

  const filtered = useMemo(() => {
    if (!filtro) return data
    if (filtro === "FALTA") return data.filter((f) => f.hasFalta)
    return data.filter((f) => f.status === filtro)
  }, [data, filtro])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {counters.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setFiltro((prev) => (prev === c.key ? null : c.key))}
            className={cn(
              "rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition hover:ring-foreground/25",
              filtro === c.key && "ring-2 ring-primary"
            )}
            aria-pressed={filtro === c.key}
          >
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Colaboradores</h2>
          {filtro && (
            <button
              type="button"
              onClick={() => setFiltro(null)}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Limpar filtro ({filtered.length} de {data.length})
            </button>
          )}
        </div>
        <FechamentoTable data={filtered} competencia={competencia} canEdit={canEdit} />
      </div>
    </div>
  )
}
