"use client"

import { useMemo, useState } from "react"

import {
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import { cn } from "@/lib/utils"
import {
  FechamentoTable,
  type FechamentoRow,
} from "@/components/rh/fechamento-table"

// "PENDENTE" não é status de espelho: é o recorte de quem ainda tem ocorrência
// sem justificativa, que é o trabalho que sobra nesta aba.
type StatusFiltro = "ABERTO" | "EM_ANALISE" | "ENCERRADO" | "PENDENTE"

const ORDEM_TIPOS: OcorrenciaTipo[] = [
  "IMPAR",
  "FALTA",
  "ATRASO",
  "SAIDA_ANTECIPADA",
  "HORA_EXTRA",
  "INTERVALO",
]

export function FechamentoBoard({
  data,
  competencia,
  canEdit,
}: {
  data: FechamentoRow[]
  competencia: string
  canEdit: boolean
}) {
  const [status, setStatus] = useState<StatusFiltro | null>(null)
  const [tipos, setTipos] = useState<OcorrenciaTipo[]>([])
  // Liga o filtro de tipo só ao que falta justificar. Sem isso, procurar "Falta"
  // devolve também quem já tratou a falta — e some o que se queria achar.
  const [soPendentes, setSoPendentes] = useState(false)

  const counters: { key: StatusFiltro; label: string; value: number }[] = [
    { key: "ABERTO", label: "Abertos", value: data.filter((f) => f.status === "ABERTO").length },
    { key: "EM_ANALISE", label: "Em análise", value: data.filter((f) => f.status === "EM_ANALISE").length },
    { key: "ENCERRADO", label: "Encerrados", value: data.filter((f) => f.status === "ENCERRADO").length },
    { key: "PENDENTE", label: "A justificar", value: data.filter((f) => f.total > f.resolved).length },
  ]

  // A contagem do chip responde ao filtro de status (e ao "só pendentes"), mas não
  // ao próprio filtro de tipo: o número diz quantos o clique traria.
  const porStatus = useMemo(
    () =>
      data.filter((f) => {
        if (!status) return true
        if (status === "PENDENTE") return f.total > f.resolved
        return f.status === status
      }),
    [data, status]
  )

  const chips = useMemo(
    () =>
      ORDEM_TIPOS.map((tipo) => ({
        tipo,
        label: OCORRENCIA_LABEL[tipo],
        value: porStatus.filter((f) =>
          (soPendentes ? f.tiposPendentes : f.tipos).includes(tipo)
        ).length,
      })).filter((c) => c.value > 0 || tipos.includes(c.tipo)),
    [porStatus, soPendentes, tipos]
  )

  const filtered = useMemo(
    () =>
      porStatus.filter(
        (f) =>
          tipos.length === 0 ||
          tipos.some((t) =>
            (soPendentes ? f.tiposPendentes : f.tipos).includes(t)
          )
      ),
    [porStatus, tipos, soPendentes]
  )

  const filtrando = status !== null || tipos.length > 0

  const toggleTipo = (tipo: OcorrenciaTipo) =>
    setTipos((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    )

  const limpar = () => {
    setStatus(null)
    setTipos([])
    setSoPendentes(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {counters.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setStatus((prev) => (prev === c.key ? null : c.key))}
            className={cn(
              "rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition hover:ring-foreground/25",
              status === c.key && "ring-2 ring-primary"
            )}
            aria-pressed={status === c.key}
          >
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </button>
        ))}
      </div>

      {data.length > 0 && (
        <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Tipo de ocorrência</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={soPendentes}
                onChange={(e) => setSoPendentes(e.target.checked)}
                className="size-4 accent-primary"
              />
              Só as não justificadas
            </label>
          </div>
          {/* O painel não some quando zera: sumir levaria junto o checkbox que
              causou o vazio, deixando o usuário sem como voltar atrás. */}
          {chips.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {soPendentes
                ? "Nenhuma ocorrência a justificar neste recorte."
                : "Nenhuma ocorrência neste recorte."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => {
              const ativo = tipos.includes(c.tipo)
              return (
                <button
                  key={c.tipo}
                  type="button"
                  onClick={() => toggleTipo(c.tipo)}
                  aria-pressed={ativo}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition",
                    ativo
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-muted/60 text-muted-foreground ring-transparent hover:text-foreground"
                  )}
                >
                  {c.label}
                  <span
                    className={cn(
                      "rounded-md px-1.5 text-xs",
                      ativo ? "bg-primary-foreground/20" : "bg-foreground/10"
                    )}
                  >
                    {c.value}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium">Colaboradores</h2>
          {filtrando && (
            <button
              type="button"
              onClick={limpar}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Limpar filtros ({filtered.length} de {data.length})
            </button>
          )}
        </div>
        <FechamentoTable data={filtered} competencia={competencia} canEdit={canEdit} />
      </div>
    </div>
  )
}
