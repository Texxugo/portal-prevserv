"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react"
import { toast } from "sonner"

import {
  encerrarFechamento,
  reabrirFechamento,
  salvarJustificativa,
  salvarJustificativaLote,
} from "@/lib/actions/fechamento"
import {
  JUSTIFICATIVA_CATEGORIAS,
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import { cn } from "@/lib/utils"
import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type OcorrenciaView = {
  id: string
  data: string
  tipo: string
  detalhe: string
  marcacoes: string
  categoria: string | null
  obs: string | null
  resolvido: boolean
  documentPendencias: { id: string; typeName: string; status: string }[]
}

export type EventoView = {
  id: string
  action: string
  description: string | null
  actorName: string
  quando: string
}

const EVENTO_LABEL: Record<string, string> = {
  JUSTIFICATIVA: "Justificativa",
  JUSTIFICATIVA_LOTE: "Justificativa em lote",
  ENCERRADO: "Encerrado",
  REABERTO: "Reaberto",
  IMPORTADO: "Importado",
  REPROCESSADO: "Reprocessado",
}

const TIPO_CLASS: Record<string, string> = {
  FALTA: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  IMPAR: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ATRASO: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  SAIDA_ANTECIPADA: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  HORA_EXTRA: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  INTERVALO: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  ABERTO: {
    label: "Aberto",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  EM_ANALISE: {
    label: "Em análise",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  ENCERRADO: {
    label: "Encerrado",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
}

const CAT_ITEMS = Object.fromEntries(JUSTIFICATIVA_CATEGORIAS.map((c) => [c, c]))
const PAGE_SIZE = 1

function tipoLabel(t: string) {
  return OCORRENCIA_LABEL[t as OcorrenciaTipo] ?? t
}

function OcorrenciaCard({
  item,
  readOnly,
  canManageDocuments,
  onChange,
}: {
  item: OcorrenciaView
  readOnly: boolean
  canManageDocuments: boolean
  onChange: (patch: Partial<OcorrenciaView>) => void
}) {
  const [saving, start] = useTransition()

  function save() {
    start(async () => {
      const r = await salvarJustificativa(
        item.id,
        item.categoria || null,
        item.obs || null
      )
      if (!r.ok) {
        toast.error(r.error || "Não foi possível salvar.")
        return
      }
      onChange({ resolvido: !!item.categoria })
      toast.success("Justificativa salva.")
    })
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      {/* O que aconteceu */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.data}</span>
            <Badge variant="secondary" className={cn(TIPO_CLASS[item.tipo])}>
              {tipoLabel(item.tipo)}
            </Badge>
            {item.resolvido ? (
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2 className="size-3" /> Justificada
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
              >
                Sem justificativa
              </Badge>
            )}
          </div>
          {item.detalhe && (
            <p className="text-sm text-muted-foreground">{item.detalhe}</p>
          )}
        </div>
        {item.marcacoes && (
          <span className="font-mono text-sm text-muted-foreground">
            {item.marcacoes}
          </span>
        )}
      </div>

      {/* Como justificar */}
      <div className="space-y-3 border-t border-foreground/10 pt-4">
        <div className="space-y-1">
          <Label>Categoria</Label>
          <Select
            value={item.categoria ?? ""}
            items={CAT_ITEMS}
            onValueChange={(v) => onChange({ categoria: v || null })}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Sem justificativa —</SelectItem>
              {JUSTIFICATIVA_CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Observação</Label>
          <Textarea
            value={item.obs ?? ""}
            onChange={(e) => onChange({ obs: e.target.value })}
            rows={2}
            placeholder="Detalhes adicionais (opcional)"
            disabled={readOnly}
          />
        </div>
        {(!readOnly ||
          item.documentPendencias.length > 0 ||
          (canManageDocuments && item.resolvido)) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {item.documentPendencias.map((pending) => (
                <ButtonLink
                  key={pending.id}
                  variant="outline"
                  size="sm"
                  href={`/rh/pendencias?id=${pending.id}`}
                >
                  {pending.typeName} ·{" "}
                  {pending.status === "SOLICITADO" ? "Solicitado" : "Pendente"}
                </ButtonLink>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManageDocuments && item.resolvido && (
                <ButtonLink
                  variant="outline"
                  size="sm"
                  href={`/rh/pendencias/nova?occurrenceId=${item.id}`}
                >
                  <FilePlus2 className="size-4" /> Solicitar documento
                </ButtonLink>
              )}
              {!readOnly && (
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Salvar justificativa
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function FechamentoDetail({
  fechamentoId,
  status: initialStatus,
  locked,
  ocorrencias,
  openDocumentCount,
  canManageDocuments,
  eventos,
}: {
  fechamentoId: string
  status: string
  locked: boolean
  ocorrencias: OcorrenciaView[]
  openDocumentCount: number
  canManageDocuments: boolean
  eventos: EventoView[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [items, setItems] = useState(() => ocorrencias.map((o) => ({ ...o })))
  const [pendingAction, startAction] = useTransition()
  const [bulkCat, setBulkCat] = useState("")
  const [bulkObs, setBulkObs] = useState("")
  const [bulkPending, startBulk] = useTransition()
  const [page, setPage] = useState(0)

  const allResolved = items.every((i) => i.resolvido)
  const pendentes = items.filter((i) => !i.resolvido).length
  const readOnly = status === "ENCERRADO" || locked
  const st = STATUS_META[status] ?? { label: status, className: "" }

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const pageItems = items.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE
  )

  function updateItem(id: string, patch: Partial<OcorrenciaView>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function aplicarLote() {
    const ids = items.filter((i) => !i.resolvido).map((i) => i.id)
    if (ids.length === 0) return
    startBulk(async () => {
      const r = await salvarJustificativaLote(ids, bulkCat || null, bulkObs || null)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível aplicar em lote.")
        return
      }
      const idSet = new Set(ids)
      setItems((prev) =>
        prev.map((i) =>
          idSet.has(i.id)
            ? { ...i, categoria: bulkCat || null, obs: bulkObs || null, resolvido: !!bulkCat }
            : i
        )
      )
      toast.success(`Aplicado a ${ids.length} ocorrência(s).`)
    })
  }

  function encerrar() {
    if (
      openDocumentCount > 0 &&
      !window.confirm(
        `Existem ${openDocumentCount} pendência(s) documental(is) em aberto. Deseja encerrar o espelho mesmo assim?`
      )
    ) {
      return
    }
    startAction(async () => {
      const r = await encerrarFechamento(fechamentoId)
      if (r.ok) {
        setStatus("ENCERRADO")
        toast.success("Espelho encerrado.")
        router.refresh()
        return
      }
      if (r.needsConfirm) {
        if (!window.confirm(`${r.error} Encerrar mesmo assim?`)) return
        const forced = await encerrarFechamento(fechamentoId, true)
        if (forced.ok) {
          setStatus("ENCERRADO")
          toast.success("Espelho encerrado.")
          router.refresh()
        } else {
          toast.error(forced.error || "Não foi possível encerrar.")
        }
        return
      }
      toast.error(r.error || "Não foi possível encerrar.")
    })
  }

  function reabrir() {
    startAction(async () => {
      const r = await reabrirFechamento(fechamentoId)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível reabrir.")
        return
      }
      setStatus("EM_ANALISE")
      toast.success("Espelho reaberto.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn(st.className)}>
            {st.label}
          </Badge>
          {locked && (
            <Badge
              variant="secondary"
              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            >
              Competência fechada
            </Badge>
          )}
        </div>
        {!locked &&
          (status === "ENCERRADO" ? (
            <Button variant="outline" onClick={reabrir} disabled={pendingAction}>
              {pendingAction ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unlock className="size-4" />
              )}
              Reabrir
            </Button>
          ) : (
            <Button
              onClick={encerrar}
              disabled={pendingAction}
            >
              {pendingAction ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              Encerrar espelho
            </Button>
          ))}
      </div>

      {openDocumentCount > 0 && status !== "ENCERRADO" && (
        <div className="flex gap-3 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Há {openDocumentCount} pendência(s) documental(is) em aberto. O espelho pode ser encerrado; o acompanhamento continuará em Pendências documentais.
          </p>
        </div>
      )}

      {!readOnly && items.length > 0 && pendentes > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="space-y-1">
            <Label>Justificar em lote</Label>
            <Select value={bulkCat} items={CAT_ITEMS} onValueChange={(v) => setBulkCat(v || "")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {JUSTIFICATIVA_CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-40 flex-1 space-y-1">
            <Label>Observação (opcional)</Label>
            <Input value={bulkObs} onChange={(e) => setBulkObs(e.target.value)} />
          </div>
          <Button variant="outline" onClick={aplicarLote} disabled={bulkPending || !bulkCat}>
            {bulkPending && <Loader2 className="size-4 animate-spin" />}
            Aplicar às pendentes ({pendentes})
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Sem ocorrências — nada a justificar. Pode encerrar.
        </div>
      ) : (
        <>
          {pageItems.map((it) => (
            <OcorrenciaCard
              key={it.id}
              item={it}
              readOnly={readOnly}
              canManageDocuments={canManageDocuments}
              onChange={(p) => updateItem(it.id, p)}
            />
          ))}
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-muted-foreground">
                Página {current + 1} de {pageCount} · {items.length} ocorrência(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={current === 0}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={current >= pageCount - 1}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {!readOnly && !allResolved && items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {pendentes} ocorrência(s) sem justificativa. Você pode encerrar mesmo assim
          (será pedida confirmação).
        </p>
      )}

      {eventos.length > 0 && (
        <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Histórico</h2>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto overscroll-contain pr-2">
            {eventos.map((e) => (
              <li key={e.id} className="text-sm text-muted-foreground">
                <span className="text-foreground">
                  {EVENTO_LABEL[e.action] ?? e.action}
                </span>
                {e.description && ` — ${e.description}`}
                <span className="block text-xs">
                  {e.actorName} · {e.quando}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
