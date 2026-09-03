"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
import { CorrecaoPontoCard } from "@/components/rh/correcao-ponto-card"
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
  // Só em "Marcação incompleta": código do documento de correção já emitido.
  correcaoCodigo: string | null
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
  CORRECAO_GERADA: "Documento de correção",
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

function tipoLabel(t: string) {
  return OCORRENCIA_LABEL[t as OcorrenciaTipo] ?? t
}

// Uma ocorrência da lista: a linha resume, o corpo aberto justifica. Fechada, a
// linha já diz tudo que decide o próximo passo — data, tipo, batidas e categoria.
function OcorrenciaLinha({
  item,
  aberto,
  sujo,
  selecionado,
  readOnly,
  canManageDocuments,
  onToggleAberto,
  onToggleSelecao,
  onChange,
  onSalvo,
}: {
  item: OcorrenciaView
  aberto: boolean
  sujo: boolean
  selecionado: boolean
  readOnly: boolean
  canManageDocuments: boolean
  onToggleAberto: () => void
  onToggleSelecao: () => void
  onChange: (patch: Partial<OcorrenciaView>) => void
  onSalvo: () => void
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
      onSalvo()
      toast.success("Justificativa salva.")
    })
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-card ring-1 transition",
        sujo ? "ring-amber-500/50" : "ring-foreground/10"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {!readOnly && (
          <input
            type="checkbox"
            checked={selecionado}
            onChange={onToggleSelecao}
            className="size-4 shrink-0 accent-primary"
            aria-label={`Selecionar ocorrência de ${item.data}`}
          />
        )}
        <button
          type="button"
          onClick={onToggleAberto}
          aria-expanded={aberto}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
        >
          <span className="font-medium">{item.data}</span>
          <Badge variant="secondary" className={cn(TIPO_CLASS[item.tipo])}>
            {tipoLabel(item.tipo)}
          </Badge>
          {item.marcacoes && (
            <span className="font-mono text-sm text-muted-foreground">
              {item.marcacoes}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {sujo && (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
              >
                Não salvo
              </Badge>
            )}
            {item.resolvido ? (
              <span className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                {item.categoria}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Sem justificativa
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                aberto && "rotate-180"
              )}
            />
          </span>
        </button>
      </div>

      {aberto && (
        <div className="space-y-3 border-t border-foreground/10 p-4">
          {item.detalhe && (
            <p className="text-sm text-muted-foreground">{item.detalhe}</p>
          )}

          {/* Marcação incompleta: o papel que o colaborador e o líder assinam
              com os horários que faltaram. */}
          {item.tipo === "IMPAR" && (
            <CorrecaoPontoCard
              occurrenceId={item.id}
              codigo={item.correcaoCodigo}
              canEdit={canManageDocuments}
            />
          )}

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
                <Button size="sm" onClick={save} disabled={saving || !sujo}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {sujo ? "Salvar justificativa" : "Salvo"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
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

  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  // Editado na tela e ainda não gravado. Sem isso a alteração some ao sair da
  // página sem que ninguém perceba — era a pegadinha do fluxo antigo.
  const [sujos, setSujos] = useState<Set<string>>(new Set())

  const [filtroTipo, setFiltroTipo] = useState("")
  const [soPendentes, setSoPendentes] = useState(false)

  const resolvidos = items.filter((i) => i.resolvido).length
  const pendentes = items.length - resolvidos
  const readOnly = status === "ENCERRADO" || locked
  const st = STATUS_META[status] ?? { label: status, className: "" }

  const tiposPresentes = useMemo(
    () => [...new Set(items.map((i) => i.tipo))],
    [items]
  )
  const tipoItems = useMemo(
    () =>
      Object.fromEntries([
        ["", "Todos os tipos"],
        ...tiposPresentes.map((t) => [t, tipoLabel(t)] as const),
      ]),
    [tiposPresentes]
  )

  const visiveis = useMemo(
    () =>
      items.filter(
        (i) =>
          (!filtroTipo || i.tipo === filtroTipo) &&
          (!soPendentes || !i.resolvido)
      ),
    [items, filtroTipo, soPendentes]
  )

  // A seleção só vale para o que está à vista: aplicar em lote a uma linha
  // escondida por um filtro seria uma alteração que ninguém pediu nem viu.
  const idsVisiveis = useMemo(() => visiveis.map((i) => i.id), [visiveis])
  const selecionadosVisiveis = idsVisiveis.filter((id) => selecao.has(id))
  const todosSelecionados =
    idsVisiveis.length > 0 && selecionadosVisiveis.length === idsVisiveis.length

  function updateItem(id: string, patch: Partial<OcorrenciaView>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    // `resolvido` só muda junto de uma gravação; o que suja é a edição do texto.
    if (!("resolvido" in patch)) {
      setSujos((prev) => new Set(prev).add(id))
    }
  }

  function marcarSalvo(id: string) {
    setSujos((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string
  ) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  function toggleTodos() {
    setSelecao((prev) => {
      const next = new Set(prev)
      if (todosSelecionados) idsVisiveis.forEach((id) => next.delete(id))
      else idsVisiveis.forEach((id) => next.add(id))
      return next
    })
  }

  function aplicarLote() {
    const ids = selecionadosVisiveis
    if (ids.length === 0) return
    startBulk(async () => {
      const r = await salvarJustificativaLote(
        ids,
        bulkCat || null,
        bulkObs || null
      )
      if (!r.ok) {
        toast.error(r.error || "Não foi possível aplicar em lote.")
        return
      }
      const idSet = new Set(ids)
      setItems((prev) =>
        prev.map((i) =>
          idSet.has(i.id)
            ? {
                ...i,
                categoria: bulkCat || null,
                obs: bulkObs || null,
                resolvido: !!bulkCat,
              }
            : i
        )
      )
      // Gravou no servidor: o que estava sujo nesses ids deixou de estar.
      setSujos((prev) => new Set([...prev].filter((id) => !idSet.has(id))))
      setSelecao(new Set())
      setBulkCat("")
      setBulkObs("")
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
    if (
      sujos.size > 0 &&
      !window.confirm(
        `Há ${sujos.size} justificativa(s) editada(s) e não salva(s). Elas serão perdidas. Encerrar mesmo assim?`
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

  const pct = items.length === 0 ? 100 : (resolvidos / items.length) * 100

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
            <Button onClick={encerrar} disabled={pendingAction}>
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
            Há {openDocumentCount} pendência(s) documental(is) em aberto. O espelho
            pode ser encerrado; o acompanhamento continuará em Pendências
            documentais.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Sem ocorrências — nada a justificar. Pode encerrar.
        </div>
      ) : (
        <>
          {/* Progresso: quanto falta para o espelho poder ser encerrado. */}
          <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {resolvidos} de {items.length} justificadas
              </span>
              <span className="text-muted-foreground">
                {pendentes > 0 ? `${pendentes} a justificar` : "Tudo justificado"}
                {sujos.size > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}
                    · {sujos.size} não salva(s)
                  </span>
                )}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={resolvidos}
              aria-valuemin={0}
              aria-valuemax={items.length}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Filtros: o mesmo recorte do board, agora dentro do espelho. */}
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={filtroTipo}
              items={tipoItems}
              onValueChange={(v) => setFiltroTipo(v || "")}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os tipos</SelectItem>
                {tiposPresentes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {tipoLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={soPendentes}
                onChange={(e) => setSoPendentes(e.target.checked)}
                className="size-4 accent-primary"
              />
              Só as não justificadas
            </label>
            {!readOnly && idsVisiveis.length > 0 && (
              <button
                type="button"
                onClick={toggleTodos}
                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                {todosSelecionados
                  ? "Limpar seleção"
                  : `Selecionar ${idsVisiveis.length} visível(is)`}
              </button>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {visiveis.length} de {items.length}
            </span>
          </div>

          {/* Barra de lote: age só sobre o que está marcado, e some quando nada
              está. Substitui o antigo "aplicar a todas as pendentes". */}
          {!readOnly && selecionadosVisiveis.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/30">
              <div className="space-y-1">
                <Label>
                  {selecionadosVisiveis.length} selecionada(s) · categoria
                </Label>
                <Select
                  value={bulkCat}
                  items={CAT_ITEMS}
                  onValueChange={(v) => setBulkCat(v || "")}
                >
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
                <Input
                  value={bulkObs}
                  onChange={(e) => setBulkObs(e.target.value)}
                />
              </div>
              <Button onClick={aplicarLote} disabled={bulkPending || !bulkCat}>
                {bulkPending && <Loader2 className="size-4 animate-spin" />}
                Aplicar às {selecionadosVisiveis.length}
              </Button>
              <Button variant="outline" onClick={() => setSelecao(new Set())}>
                Limpar
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {visiveis.map((it) => (
              <OcorrenciaLinha
                key={it.id}
                item={it}
                aberto={abertos.has(it.id)}
                sujo={sujos.has(it.id)}
                selecionado={selecao.has(it.id)}
                readOnly={readOnly}
                canManageDocuments={canManageDocuments}
                onToggleAberto={() => toggleSet(abertos, setAbertos, it.id)}
                onToggleSelecao={() => toggleSet(selecao, setSelecao, it.id)}
                onChange={(p) => updateItem(it.id, p)}
                onSalvo={() => marcarSalvo(it.id)}
              />
            ))}
            {visiveis.length === 0 && (
              <div className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                Nenhuma ocorrência neste recorte.
              </div>
            )}
          </div>
        </>
      )}

      {!readOnly && pendentes > 0 && items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {pendentes} ocorrência(s) sem justificativa. Você pode encerrar mesmo
          assim (será pedida confirmação).
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
