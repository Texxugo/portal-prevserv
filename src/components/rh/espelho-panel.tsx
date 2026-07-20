"use client"

import { useActionState, useMemo, useRef, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Save,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  enviarWhatsapp,
  previewEspelho,
  type EspelhoItem,
  type EspelhoState,
} from "@/lib/actions/espelho"
import { createDocumentoPendencia } from "@/lib/actions/documentos"
import { importarEspelhoFechamento } from "@/lib/actions/fechamento"
import { ButtonLink } from "@/components/button-link"
import { OnDutyBadge } from "@/components/rh/on-duty-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type Option = { value: string; label: string }
type DocumentType = { id: string; name: string }
const PAGE_SIZE = 10
const keyOf = (item: EspelhoItem) => `${item.matricula}|${item.nome}`

function defaultFollowUp(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function PreviewButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Upload className="size-4" />
      )}
      Pré-visualizar
    </Button>
  )
}

function ReviewCard({
  item,
  competencia,
  message,
  onMessageChange,
  sent,
  onSent,
  documentTypes,
  pendSent,
  onPendSent,
  onRemove,
}: {
  item: EspelhoItem
  competencia: string
  message: string
  onMessageChange: (value: string) => void
  sent: boolean
  onSent: () => void
  documentTypes: DocumentType[]
  pendSent: boolean
  onPendSent: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const canSend = item.matched && !!item.phone && !sent

  const [pendOpen, setPendOpen] = useState(false)
  const [pendPending, startPend] = useTransition()
  const [pendType, setPendType] = useState("")
  const [pendReason, setPendReason] = useState(message)
  const [pendFollowUp, setPendFollowUp] = useState(defaultFollowUp)
  const canPend = item.matched && !!item.employeeId && !pendSent
  const typeItems = Object.fromEntries(documentTypes.map((t) => [t.id, t.name]))

  function openPend() {
    setPendReason(message)
    setPendType("")
    setPendFollowUp(defaultFollowUp())
    setPendOpen(true)
  }

  function confirmPend() {
    startPend(async () => {
      const r = await createDocumentoPendencia({
        employeeId: item.employeeId!,
        competencia,
        documentTypeId: pendType,
        reason: pendReason,
        followUpDate: pendFollowUp,
      })
      if (!r.ok) {
        toast.error(r.error || "Não foi possível criar a pendência.")
        return
      }
      toast.success(`Pendência criada para ${item.nome}.`)
      onPendSent()
      setPendOpen(false)
    })
  }

  function confirmSend() {
    startTransition(async () => {
      const r = await enviarWhatsapp({
        employeeId: item.employeeId,
        matricula: item.matricula,
        nome: item.nome,
        phone: item.phone,
        competencia,
        message,
      })
      if (r.ok) {
        onSent()
        toast.success(`Mensagem enviada para ${item.nome}.`)
      } else {
        toast.error(r.error || "Falha ao enviar.")
      }
      setOpen(false)
    })
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.nome}</p>
            <OnDutyBadge onDuty={item.onDutyToday} />
          </div>
          <p className="text-sm text-muted-foreground">
            Matrícula {item.matricula || "—"} · {item.phone || "sem telefone"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {sent ? (
            <Badge
              variant="secondary"
              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            >
              Enviado
            </Badge>
          ) : item.matched ? (
            <Badge variant="secondary">Encontrado</Badge>
          ) : (
            <Badge
              variant="secondary"
              className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
            >
              Não encontrado
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remover da lista"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Data</TableHead>
              <TableHead className="w-44">Tipo</TableHead>
              <TableHead>Marcações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {item.dias.map((d, i) => (
              <TableRow key={i}>
                <TableCell>{d.data}</TableCell>
                <TableCell>
                  <span title={d.detalhe}>{d.tipo}</span>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {d.marcacoes.join("  ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <Label>Mensagem</Label>
        <Textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={6}
        />
      </div>

      {!item.matched && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4" />
          Colaborador não encontrado no cadastro — não é possível enviar.
        </p>
      )}
      {item.matched && !item.phone && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4" />
          Sem telefone cadastrado — não é possível enviar.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)} disabled={!canSend}>
          <Send className="size-4" />
          Enviar WhatsApp
        </Button>
        <Button variant="outline" onClick={openPend} disabled={!canPend}>
          <ClipboardList className="size-4" />
          {pendSent ? "Na pendência" : "Enviar para pendência"}
        </Button>
      </div>

      <Dialog open={pendOpen} onOpenChange={setPendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para pendência</DialogTitle>
            <DialogDescription>
              Criar pendência documental para {item.nome} na competência {competencia}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select value={pendType} onValueChange={(v) => setPendType(v ?? "")} items={typeItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pend-reason-${item.matricula}`}>Motivo</Label>
              <Textarea
                id={`pend-reason-${item.matricula}`}
                value={pendReason}
                onChange={(e) => setPendReason(e.target.value)}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pend-follow-${item.matricula}`}>Cobrar novamente em *</Label>
              <Input
                id={`pend-follow-${item.matricula}`}
                type="date"
                value={pendFollowUp}
                onChange={(e) => setPendFollowUp(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendOpen(false)} disabled={pendPending}>
              Cancelar
            </Button>
            <Button onClick={confirmPend} disabled={pendPending || !pendType || !pendFollowUp}>
              {pendPending && <Loader2 className="size-4 animate-spin" />}
              Criar pendência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Enviar mensagem</DialogTitle>
            <DialogDescription>
              Enviar para {item.nome} ({item.phone}) via WhatsApp?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button onClick={confirmSend} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function EspelhoPanel({
  competenciaOptions,
  defaultCompetencia,
  documentTypes,
}: {
  competenciaOptions: Option[]
  defaultCompetencia: string
  documentTypes: DocumentType[]
}) {
  const [state, formAction] = useActionState<EspelhoState, FormData>(
    previewEspelho,
    undefined
  )
  const items = useMemo(
    () => (state?.status === "preview" ? (state.items ?? []) : []),
    [state]
  )
  const competencia = state?.competencia ?? defaultCompetencia
  const compItems = Object.fromEntries(
    competenciaOptions.map((o) => [o.value, o.label])
  )

  // Estado por card elevado para não perder ao paginar
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set())
  const [pendKeys, setPendKeys] = useState<Set<string>>(new Set())
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const fileRef = useRef<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [savingHist, startSaveHist] = useTransition()
  const [savedComp, setSavedComp] = useState<string | null>(null)

  // Novo preview → zera tudo (reset durante o render, sem useEffect)
  const [prevState, setPrevState] = useState(state)
  if (state !== prevState) {
    setPrevState(state)
    setMessages({})
    setSentKeys(new Set())
    setPendKeys(new Set())
    setRemovedKeys(new Set())
    setSearch("")
    setPage(0)
    setSavedComp(null)
  }

  function salvarHistorico() {
    const file = fileRef.current
    if (!file) {
      toast.error("Selecione o arquivo e clique em Pré-visualizar.")
      return
    }
    const incluir = items
      .filter((i) => !removedKeys.has(keyOf(i)))
      .map((i) => i.matricula.trim())
      .filter(Boolean)
    if (incluir.length === 0) {
      toast.error("Nenhum colaborador na lista para salvar.")
      return
    }
    const fd = new FormData()
    fd.set("file", file)
    fd.set("competencia", competencia)
    fd.set("origem", "ESPELHOS")
    fd.set("incluirMatriculas", incluir.join(","))
    startSaveHist(async () => {
      const res = await importarEspelhoFechamento(undefined, fd)
      if (res?.status === "ok") {
        const r = res.resumo
        toast.success(
          `Histórico salvo: ${r?.processados ?? 0} processado(s) · ${r?.ocorrencias ?? 0} ocorrência(s)` +
            (r?.naoEncontrados ? ` · ${r.naoEncontrados} não encontrado(s)` : "")
        )
        setSavedComp(res.competencia ?? competencia)
      } else {
        toast.error(res?.message || "Não foi possível salvar no histórico.")
      }
    })
  }

  const visibleItems = useMemo(
    () => items.filter((i) => !removedKeys.has(keyOf(i))),
    [items, removedKeys]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return visibleItems
    return visibleItems.filter(
      (i) =>
        i.nome.toLowerCase().includes(q) ||
        i.matricula.toLowerCase().includes(q)
    )
  }, [visibleItems, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE
  )

  return (
    <div className="space-y-5">
      <form
        action={formAction}
        className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo do espelho (.txt)</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".txt"
              required
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                fileRef.current = f
                setFileName(f?.name ?? null)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="competencia">Competência</Label>
            <Select
              name="competencia"
              defaultValue={defaultCompetencia}
              items={compItems}
            >
              <SelectTrigger id="competencia" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {competenciaOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <PreviewButton />
      </form>

      {state?.status === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {state.message}
        </div>
      )}

      {state?.status === "preview" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Button variant="outline" onClick={salvarHistorico} disabled={savingHist}>
            {savingHist ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar no histórico
          </Button>
          <p className="text-sm text-muted-foreground">
            Grava no Encerramento de espelho somente os colaboradores que ficaram na lista.
            {fileName && <span className="block">Arquivo: {fileName}</span>}
          </p>
          {savedComp && (
            <ButtonLink variant="ghost" size="sm" href={`/rh/fechamento?comp=${savedComp}`}>
              Ver no Encerramento de espelho
            </ButtonLink>
          )}
        </div>
      )}

      {state?.status === "preview" &&
        (items.length === 0 ? (
          <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            Nenhuma ocorrência encontrada nesta competência.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {filtered.length} colaborador(es) com ocorrência
                {sentKeys.size > 0 && ` · ${sentKeys.size} enviado(s)`}
                {removedKeys.size > 0 && ` · ${removedKeys.size} removido(s)`}
              </p>
              <div className="relative max-w-xs">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  placeholder="Buscar por nome ou matrícula..."
                  className="pl-8"
                />
              </div>
            </div>

            {pageItems.map((it) => {
              const k = keyOf(it)
              return (
                <ReviewCard
                  key={k}
                  item={it}
                  competencia={competencia}
                  message={messages[k] ?? it.message}
                  onMessageChange={(value) =>
                    setMessages((prev) => ({ ...prev, [k]: value }))
                  }
                  sent={sentKeys.has(k)}
                  onSent={() =>
                    setSentKeys((prev) => new Set(prev).add(k))
                  }
                  documentTypes={documentTypes}
                  pendSent={pendKeys.has(k)}
                  onPendSent={() =>
                    setPendKeys((prev) => new Set(prev).add(k))
                  }
                  onRemove={() =>
                    setRemovedKeys((prev) => new Set(prev).add(k))
                  }
                />
              )
            })}

            {pageCount > 1 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm text-muted-foreground">
                  Página {current + 1} de {pageCount}
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
                    onClick={() =>
                      setPage((p) => Math.min(pageCount - 1, p + 1))
                    }
                    disabled={current >= pageCount - 1}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
