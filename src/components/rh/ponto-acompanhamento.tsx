"use client"

import { useMemo, useState, useTransition } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Loader2,
  Search,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { enviarEspelhoWhatsapp } from "@/lib/actions/espelho"
import { createDocumentoPendencia } from "@/lib/actions/documentos"
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

type DocumentType = { id: string; name: string }
const PAGE_SIZE = 10

export type AcompanhamentoDia = {
  data: string
  marcacoes: string[]
  tipo: string
  detalhe?: string
}

export type AcompanhamentoRow = {
  fechamentoId: string
  employeeId: string
  nome: string
  matricula: string | null
  phone: string | null
  status: string
  dias: AcompanhamentoDia[]
  message: string
  onDutyToday: boolean | null
  ultimoAviso: string | null
}

function defaultFollowUp(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function ReviewCard({
  row,
  competencia,
  message,
  onMessageChange,
  sent,
  onSent,
  documentTypes,
  pendSent,
  onPendSent,
  canEdit,
}: {
  row: AcompanhamentoRow
  competencia: string
  message: string
  onMessageChange: (value: string) => void
  sent: boolean
  onSent: () => void
  documentTypes: DocumentType[]
  pendSent: boolean
  onPendSent: () => void
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const canSend = canEdit && !!row.phone && !sent

  const [pendOpen, setPendOpen] = useState(false)
  const [pendPending, startPend] = useTransition()
  const [pendType, setPendType] = useState("")
  const [pendReason, setPendReason] = useState(message)
  const [pendFollowUp, setPendFollowUp] = useState(defaultFollowUp)
  const canPend = canEdit && !pendSent
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
        employeeId: row.employeeId,
        competencia,
        documentTypeId: pendType,
        reason: pendReason,
        followUpDate: pendFollowUp,
      })
      if (!r.ok) {
        toast.error(r.error || "Não foi possível criar a pendência.")
        return
      }
      toast.success(`Pendência criada para ${row.nome}.`)
      onPendSent()
      setPendOpen(false)
    })
  }

  function confirmSend() {
    startTransition(async () => {
      const r = await enviarEspelhoWhatsapp({
        fechamentoId: row.fechamentoId,
        message,
      })
      if (r.ok) {
        onSent()
        toast.success(`Mensagem enviada para ${row.nome}.`)
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
            <p className="font-medium">{row.nome}</p>
            <OnDutyBadge onDuty={row.onDutyToday} />
          </div>
          <p className="text-sm text-muted-foreground">
            Matrícula {row.matricula || "—"} · {row.phone || "sem telefone"}
            {row.ultimoAviso && ` · último aviso em ${row.ultimoAviso}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {sent && (
            <Badge
              variant="secondary"
              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            >
              Enviado
            </Badge>
          )}
          <Badge variant="secondary">
            {row.dias.length} em aberto
          </Badge>
          <ButtonLink
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir espelho"
            href={`/rh/ponto/${row.fechamentoId}?comp=${competencia}`}
          >
            <ExternalLink className="size-4" />
          </ButtonLink>
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
            {row.dias.map((d, i) => (
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

      {canEdit && (
        <>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={6}
            />
          </div>

          {!row.phone && (
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
        </>
      )}

      <Dialog open={pendOpen} onOpenChange={setPendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para pendência</DialogTitle>
            <DialogDescription>
              Criar pendência documental para {row.nome} na competência {competencia}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select
                value={pendType}
                onValueChange={(v) => setPendType(v ?? "")}
                items={typeItems}
              >
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
              <Label htmlFor={`pend-reason-${row.fechamentoId}`}>Motivo</Label>
              <Textarea
                id={`pend-reason-${row.fechamentoId}`}
                value={pendReason}
                onChange={(e) => setPendReason(e.target.value)}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pend-follow-${row.fechamentoId}`}>
                Cobrar novamente em *
              </Label>
              <Input
                id={`pend-follow-${row.fechamentoId}`}
                type="date"
                value={pendFollowUp}
                onChange={(e) => setPendFollowUp(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendOpen(false)}
              disabled={pendPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmPend}
              disabled={pendPending || !pendType || !pendFollowUp}
            >
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
              Enviar para {row.nome} ({row.phone}) via WhatsApp?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
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

export function PontoAcompanhamento({
  rows,
  competencia,
  documentTypes,
  canEdit,
}: {
  rows: AcompanhamentoRow[]
  competencia: string
  documentTypes: DocumentType[]
  canEdit: boolean
}) {
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [pendIds, setPendIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        (r.matricula ?? "").toLowerCase().includes(q)
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageIndex = Math.min(page, totalPages - 1)
  const visible = filtered.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE
  )

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
        Nenhuma ocorrência em aberto nesta competência. Importe o arquivo do Qyon acima
        para acompanhar o ponto do período.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome ou matrícula…"
            className="pl-8"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} colaborador(es) com ocorrência em aberto
          {sentIds.size > 0 && ` · ${sentIds.size} avisado(s) agora`}
        </p>
      </div>

      <div className="space-y-4">
        {visible.map((row) => (
          <ReviewCard
            key={row.fechamentoId}
            row={row}
            competencia={competencia}
            message={messages[row.fechamentoId] ?? row.message}
            onMessageChange={(value) =>
              setMessages((m) => ({ ...m, [row.fechamentoId]: value }))
            }
            sent={sentIds.has(row.fechamentoId)}
            onSent={() =>
              setSentIds((s) => new Set(s).add(row.fechamentoId))
            }
            documentTypes={documentTypes}
            pendSent={pendIds.has(row.fechamentoId)}
            onPendSent={() =>
              setPendIds((s) => new Set(s).add(row.fechamentoId))
            }
            canEdit={canEdit}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {pageIndex + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIndex >= totalPages - 1}
          >
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
