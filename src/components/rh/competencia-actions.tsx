"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, Loader2, Lock, RefreshCw, Unlock } from "lucide-react"
import { toast } from "sonner"

import {
  encerrarProntos,
  fecharCompetencia,
  reabrirCompetencia,
  reprocessarCompetencia,
} from "@/lib/actions/fechamento"
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

// Botão "Encerrar prontos": encerra em lote os espelhos sem pendência.
export function EncerrarProntosButton({
  competencia,
  prontos,
}: {
  competencia: string
  prontos: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function confirm() {
    start(async () => {
      const r = await encerrarProntos(competencia)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível encerrar em lote.")
        return
      }
      toast.success(`${r.count} espelho(s) encerrado(s).`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={prontos === 0}>
        <CheckCheck className="size-4" />
        Encerrar prontos ({prontos})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Encerrar prontos</DialogTitle>
            <DialogDescription>
              Encerrar {prontos} espelho(s) sem ocorrência pendente em{" "}
              {competenciaLabel(competencia)}? Espelhos com justificativa faltando não
              serão tocados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Fechar/Reabrir a competência inteira (trava import e edição).
export function CompetenciaLockButton({
  competencia,
  fechada,
}: {
  competencia: string
  fechada: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function fechar(force: boolean) {
    start(async () => {
      const r = await fecharCompetencia(competencia, force)
      if (r.ok) {
        toast.success("Competência fechada.")
        setOpen(false)
        router.refresh()
        return
      }
      if (r.needsConfirm) {
        setWarning(r.error ?? null)
        return
      }
      toast.error(r.error || "Não foi possível fechar a competência.")
    })
  }

  function reabrir() {
    start(async () => {
      await reabrirCompetencia(competencia)
      toast.success("Competência reaberta.")
      router.refresh()
    })
  }

  if (fechada) {
    return (
      <Button variant="outline" onClick={reabrir} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
        Reabrir competência
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setWarning(null)
          setOpen(true)
        }}
      >
        <Lock className="size-4" />
        Fechar competência
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Fechar competência</DialogTitle>
            <DialogDescription>
              Fechar {competenciaLabel(competencia)} trava importação, justificativas e
              encerramentos. Pode ser reaberta depois.
            </DialogDescription>
          </DialogHeader>
          {warning && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {warning} Fechar mesmo assim?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={() => fechar(!!warning)} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {warning ? "Fechar mesmo assim" : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Recomputa ocorrências a partir das batidas gravadas (sem novo upload).
export function ReprocessarButton({ competencia }: { competencia: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function confirm() {
    start(async () => {
      const r = await reprocessarCompetencia(competencia)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível reprocessar.")
        return
      }
      const s = r.resumo
      toast.success(
        `Reprocessado: ${s?.processados ?? 0} espelho(s) · ${s?.ocorrencias ?? 0} ocorrência(s)` +
          (s?.semDados ? ` · ${s.semDados} sem batidas gravadas` : "")
      )
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw className="size-4" />
        Reprocessar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reprocessar competência</DialogTitle>
            <DialogDescription>
              Recalcula as ocorrências a partir das batidas já importadas, usando a
              tolerância e os tipos ativos atuais. Justificativas de ocorrências que
              continuarem iguais são preservadas. Espelhos encerrados não são tocados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Reprocessar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
