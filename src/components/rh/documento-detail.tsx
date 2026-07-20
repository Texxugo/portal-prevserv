"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Ban,
  ExternalLink,
  Loader2,
  MessageCircle,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import {
  cancelarDocumento,
  corrigirMensagemDocumento,
  reabrirDocumento,
  receberDocumento,
  solicitarDocumento,
  updateDocumentoPendencia,
} from "@/lib/actions/documentos"
import { DOCUMENTO_STATUS_LABEL, type DocumentoStatus } from "@/lib/documentos"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
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

type TypeOption = { id: string; name: string }
type HistoryItem = {
  id: string
  action: string
  description: string | null
  actorName: string
  createdAt: string
}

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  SOLICITADO: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  RECEBIDO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  CANCELADO: "bg-muted text-muted-foreground",
}

export function DocumentoDetail({
  data,
  documentTypes,
  defaultMessage,
  history,
}: {
  data: {
    id: string
    employeeName: string
    matricula: string | null
    competencia: string
    status: string
    documentTypeId: string
    reason: string
    notes: string | null
    followUpDate: string
    externalUrl: string | null
    sourceLabel: string | null
    phone: string | null
  }
  documentTypes: TypeOption[]
  defaultMessage: string
  history: HistoryItem[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [status, setStatus] = useState(data.status)
  const [typeId, setTypeId] = useState(data.documentTypeId)
  const [reason, setReason] = useState(data.reason)
  const [notes, setNotes] = useState(data.notes ?? "")
  const [followUpDate, setFollowUpDate] = useState(data.followUpDate)
  const [message, setMessage] = useState(defaultMessage)
  const [externalUrl, setExternalUrl] = useState(data.externalUrl ?? "")
  const [cancelReason, setCancelReason] = useState("")
  const [reopenReason, setReopenReason] = useState("")
  const [reopenDate, setReopenDate] = useState("")
  const [correcting, setCorrecting] = useState(false)
  const open = status === "PENDENTE" || status === "SOLICITADO"
  const typeItems = Object.fromEntries(documentTypes.map((type) => [type.id, type.name]))

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, nextStatus?: string) {
    start(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error || "Não foi possível concluir a ação.")
        return
      }
      if (nextStatus) setStatus(nextStatus)
      toast.success(success)
      router.refresh()
    })
  }

  async function corrigir() {
    setCorrecting(true)
    try {
      const result = await corrigirMensagemDocumento(message)
      if (!result.ok || !result.text) {
        toast.error(result.error || "Não foi possível corrigir a mensagem.")
        return
      }
      setMessage(result.text)
      toast.success("Mensagem corrigida.")
    } finally {
      setCorrecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className={cn(STATUS_CLASS[status])}>
          {DOCUMENTO_STATUS_LABEL[status as DocumentoStatus] ?? status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {data.matricula ? `Matrícula ${data.matricula}` : "Sem matrícula"}
          {data.phone ? ` · ${data.phone}` : " · sem telefone"}
        </span>
      </div>

      {data.sourceLabel && (
        <div className="rounded-xl bg-muted/60 p-4 text-sm">
          <span className="font-medium">Origem no fechamento:</span> {data.sourceLabel}
        </div>
      )}

      <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Dados da pendência</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de documento</Label>
            <Select value={typeId} onValueChange={(v) => setTypeId(v ?? "")} items={typeItems} disabled={!open}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{documentTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-follow-up">Cobrar novamente em</Label>
            <Input id="detail-follow-up" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} disabled={!open} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="detail-reason">Motivo</Label>
            <Textarea id="detail-reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!open} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="detail-notes">Observações</Label>
            <Textarea id="detail-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!open} />
          </div>
        </div>
        {open && (
          <Button variant="outline" disabled={pending} onClick={() => run(
            () => updateDocumentoPendencia(data.id, { documentTypeId: typeId, reason, notes, followUpDate }),
            "Pendência atualizada."
          )}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar alterações
          </Button>
        )}
      </section>

      {open && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-medium">Solicitar por WhatsApp</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={correcting || pending || message.trim().length < 5}
                onClick={corrigir}
              >
                {correcting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Correção
              </Button>
            </div>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} />
            <Button disabled={pending || correcting || !data.phone || message.trim().length < 10} onClick={() => run(
              () => solicitarDocumento(data.id, { message, followUpDate }),
              "Solicitação enviada.",
              "SOLICITADO"
            )}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
              {status === "SOLICITADO" ? "Enviar novamente" : "Enviar solicitação"}
            </Button>
            {!data.phone && <p className="text-sm text-destructive">Colaborador sem telefone cadastrado.</p>}
          </section>

          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="text-base font-medium">Registrar recebimento</h2>
            <div className="space-y-2">
              <Label htmlFor="external-url">Link do Drive ou SharePoint *</Label>
              <Input id="external-url" type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Button disabled={pending || !externalUrl.trim()} onClick={() => run(
              () => receberDocumento(data.id, { externalUrl, notes }),
              "Documento recebido.",
              "RECEBIDO"
            )}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Marcar como recebido
            </Button>
          </section>
        </div>
      )}

      {open ? (
        <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-base font-medium">Cancelar pendência</h2>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento" rows={2} />
          <Button variant="destructive" disabled={pending || cancelReason.trim().length < 3} onClick={() => run(
            () => cancelarDocumento(data.id, cancelReason),
            "Pendência cancelada.",
            "CANCELADO"
          )}>
            <Ban className="size-4" /> Cancelar pendência
          </Button>
        </section>
      ) : (
        <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-medium">Pendência finalizada</h2>
            {data.externalUrl && (
              <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={data.externalUrl} target="_blank" rel="noreferrer">
                Abrir documento <ExternalLink className="size-4" />
              </a>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reopen-reason">Motivo da reabertura *</Label>
              <Textarea id="reopen-reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reopen-date">Nova data de retorno *</Label>
              <Input id="reopen-date" type="date" value={reopenDate} onChange={(e) => setReopenDate(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" disabled={pending || reopenReason.trim().length < 3 || !reopenDate} onClick={() => run(
            () => reabrirDocumento(data.id, { reason: reopenReason, followUpDate: reopenDate }),
            "Pendência reaberta.",
            "PENDENTE"
          )}>
            <RotateCcw className="size-4" /> Reabrir pendência
          </Button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Histórico</h2>
        <div className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {history.map((item) => (
            <div key={item.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr_auto] sm:items-center">
              <span className="text-sm font-medium">{item.action.replaceAll("_", " ")}</span>
              <span className="text-sm text-muted-foreground">{item.description || "—"}</span>
              <span className="text-xs text-muted-foreground">{item.actorName} · {formatDateTime(item.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
