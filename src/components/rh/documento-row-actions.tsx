"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Eye, Loader2, MoreHorizontal, Upload } from "lucide-react"
import { toast } from "sonner"

import { cancelarDocumento, receberDocumento } from "@/lib/actions/documentos"
import { isDocumentoAberto } from "@/lib/documentos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ActiveDialog = null | "receber" | "cancelar"

export function DocumentoRowActions({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dialog, setDialog] = useState<ActiveDialog>(null)
  const [externalUrl, setExternalUrl] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const open = isDocumentoAberto(status)

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error || "Não foi possível concluir a ação.")
        return
      }
      toast.success(success)
      setDialog(null)
      setExternalUrl("")
      setCancelReason("")
      router.refresh()
    })
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Ações">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/rh/pendencias?id=${id}`)}>
            <Eye className="size-4" /> Ver
          </DropdownMenuItem>
          {open && (
            <>
              <DropdownMenuItem onClick={() => setDialog("receber")}>
                <Upload className="size-4" /> Marcar recebida
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDialog("cancelar")}>
                <Ban className="size-4" /> Cancelar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "receber"} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como recebida</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="row-external-url">Link do Drive ou SharePoint *</Label>
            <Input
              id="row-external-url"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !externalUrl.trim()}
              onClick={() => run(() => receberDocumento(id, { externalUrl }), "Documento recebido.")}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancelar"} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pendência</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="row-cancel-reason">Motivo do cancelamento *</Label>
            <Textarea
              id="row-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={pending || cancelReason.trim().length < 3}
              onClick={() => run(() => cancelarDocumento(id, cancelReason), "Pendência cancelada.")}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Cancelar pendência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
