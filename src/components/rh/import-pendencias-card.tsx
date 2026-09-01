"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, CalendarClock, Link2, Undo2, UserX } from "lucide-react"
import { toast } from "sonner"

import {
  aplicarPendencia,
  ignorarPendencia,
  reabrirPendencia,
  vincularPendencia,
} from "@/lib/actions/import-pendencias"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxFilter,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { ButtonLink } from "@/components/button-link"

export type EmployeeOption = {
  value: string
  label: string
  matricula: string | null
}

export type PendenciaView = {
  id: string
  tipo: string
  nome: string
  matricula: string | null
  empresa: string | null
  employeeId: string | null
  diasCount: number
  status: string
  motivo: string | null
  fileName: string
}

const TIPO: Record<string, { label: string; className: string; ajuda: string }> = {
  NAO_ENCONTRADO: {
    label: "Não encontrado",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    ajuda: "Nenhum cadastro casa com esta matrícula ou nome.",
  },
  AMBIGUO: {
    label: "Ambíguo",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    ajuda: "Mais de um cadastro reivindica esta matrícula ou nome — escolha qual é.",
  },
  SEM_JORNADA: {
    label: "Sem jornada",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    ajuda: "Casou com o cadastro, mas falta a escala — sem ela não há o que comparar.",
  },
}

function ListaColaboradores() {
  return (
    <ComboboxContent>
      <ComboboxEmpty>Nenhum colaborador encontrado.</ComboboxEmpty>
      <ComboboxList>
        {(item: EmployeeOption) => (
          <ComboboxItem key={item.value} value={item}>
            <span className="flex-1 truncate">{item.label}</span>
            {item.matricula && (
              <span className="text-xs text-muted-foreground">{item.matricula}</span>
            )}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  )
}

function PendenciaRow({
  pendencia,
  employees,
  canEdit,
}: {
  pendencia: PendenciaView
  employees: EmployeeOption[]
  canEdit: boolean
}) {
  const [selecionado, setSelecionado] = useState<EmployeeOption | null>(null)
  const [motivoAberto, setMotivoAberto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [pending, startTransition] = useTransition()
  const filter = useComboboxFilter()

  const tipo = TIPO[pendencia.tipo] ?? {
    label: pendencia.tipo,
    className: "",
    ajuda: "",
  }
  const ignorada = pendencia.status === "IGNORADA"

  const executar = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.ok) toast.success(r.message ?? "Pendência resolvida.")
      else toast.error(r.error ?? "Não foi possível concluir.")
    })

  return (
    <li className="space-y-3 rounded-lg bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={tipo.className}>
          {tipo.label}
        </Badge>
        <span className="font-medium">{pendencia.nome}</span>
        <span className="text-sm text-muted-foreground">
          matrícula {pendencia.matricula || "—"}
          {pendencia.empresa && ` · empresa ${pendencia.empresa}`} ·{" "}
          {pendencia.diasCount} dia(s) represado(s)
        </span>
        {ignorada && (
          <Badge variant="secondary">
            Ignorada{pendencia.motivo ? `: ${pendencia.motivo}` : ""}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{tipo.ajuda}</p>

      {canEdit && !ignorada && (
        <div className="flex flex-wrap items-end gap-2">
          {pendencia.tipo === "SEM_JORNADA" ? (
            <>
              {pendencia.employeeId && (
                <ButtonLink
                  variant="outline"
                  size="sm"
                  href={`/rh/${pendencia.employeeId}`}
                >
                  <CalendarClock className="size-4" />
                  Cadastrar jornada
                </ButtonLink>
              )}
              <Button
                size="sm"
                disabled={pending}
                onClick={() => executar(() => aplicarPendencia(pendencia.id))}
              >
                Aplicar batidas
              </Button>
            </>
          ) : (
            <>
              <div className="w-full max-w-xs">
                <Combobox
                  items={employees}
                  value={selecionado}
                  onValueChange={(v: EmployeeOption | null) => setSelecionado(v)}
                  isItemEqualToValue={(a: EmployeeOption, b: EmployeeOption) =>
                    a.value === b.value
                  }
                  filter={(item: EmployeeOption, query: string) =>
                    filter.contains(item.label, query) ||
                    (!!item.matricula && filter.contains(item.matricula, query))
                  }
                  autoHighlight
                >
                  <ComboboxInput placeholder="Vincular ao colaborador…" />
                  <ListaColaboradores />
                </Combobox>
              </div>
              <Button
                size="sm"
                disabled={pending || !selecionado}
                onClick={() =>
                  selecionado &&
                  executar(() => vincularPendencia(pendencia.id, selecionado.value))
                }
              >
                <Link2 className="size-4" />
                Vincular
              </Button>
            </>
          )}

          {motivoAberto ? (
            <>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (ex.: prestador externo)"
                className="w-56"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => executar(() => ignorarPendencia(pendencia.id, motivo))}
              >
                Confirmar
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setMotivoAberto(true)}
            >
              <UserX className="size-4" />
              Ignorar
            </Button>
          )}
        </div>
      )}

      {canEdit && ignorada && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => executar(() => reabrirPendencia(pendencia.id))}
        >
          <Undo2 className="size-4" />
          Reabrir
        </Button>
      )}
    </li>
  )
}

export function ImportPendenciasCard({
  pendencias,
  employees,
  canEdit,
}: {
  pendencias: PendenciaView[]
  employees: EmployeeOption[]
  canEdit: boolean
}) {
  const [verIgnoradas, setVerIgnoradas] = useState(false)
  const abertas = pendencias.filter((p) => p.status === "ABERTA")
  const ignoradas = pendencias.filter((p) => p.status === "IGNORADA")
  const visiveis = verIgnoradas ? [...abertas, ...ignoradas] : abertas

  if (abertas.length === 0 && ignoradas.length === 0) return null

  return (
    <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <AlertTriangle className="size-5 text-amber-600" />
          Pendências de importação
          {abertas.length > 0 && <Badge variant="secondary">{abertas.length}</Badge>}
        </h2>
        {ignoradas.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVerIgnoradas((v) => !v)}
          >
            {verIgnoradas ? "Ocultar" : "Ver"} ignoradas ({ignoradas.length})
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Linhas do arquivo que não entraram no espelho. As batidas ficam guardadas aqui —
        resolver aplica direto, sem precisar importar o TXT de novo.
      </p>

      <ul className="space-y-2">
        {visiveis.map((p) => (
          <PendenciaRow
            key={p.id}
            pendencia={p}
            employees={employees}
            canEdit={canEdit}
          />
        ))}
      </ul>
    </div>
  )
}
