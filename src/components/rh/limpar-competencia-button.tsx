"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { limparCompetencia } from "@/lib/actions/fechamento"
import { competenciaLabel } from "@/lib/competencia"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function LimparCompetenciaButton({ competencia }: { competencia: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function confirm() {
    start(async () => {
      const r = await limparCompetencia(competencia)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível limpar a competência.")
        return
      }
      toast.success(`${r.count} espelho(s) removido(s).`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        Limpar competência
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Limpar competência</DialogTitle>
            <DialogDescription>
              Remover todos os espelhos de {competenciaLabel(competencia)}? Esta ação não
              poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Limpar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
