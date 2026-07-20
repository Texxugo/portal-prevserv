"use client"

import { useState, useTransition } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ConfirmDelete({
  onConfirm,
  title = "Confirmar exclusão",
  description = "Esta ação não poderá ser desfeita.",
  successMessage = "Registro excluído com sucesso.",
  triggerLabel = "Excluir",
}: {
  onConfirm: () => Promise<void>
  title?: string
  description?: string
  successMessage?: string
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm()
        toast.success(successMessage)
        setOpen(false)
      } catch {
        toast.error("Não foi possível excluir o registro.")
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={triggerLabel}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
