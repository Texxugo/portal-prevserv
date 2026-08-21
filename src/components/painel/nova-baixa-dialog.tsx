"use client"

import { useActionState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { criarVaga } from "@/lib/actions/painel"
import type { FormState } from "@/lib/form"
import { COBERTURA_MOTIVO_LABEL, COBERTURA_MOTIVOS } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea"

// Base UI Select: `items` mapeia valor → rótulo exibido no gatilho. Sem isso o
// campo mostraria "DIURNO", "FALTA" e o id cru do posto.
const PERIODO_ITEMS = { DIURNO: "Diurno", NOTURNO: "Noturno" }
const MOTIVO_ITEMS = Object.fromEntries(
  COBERTURA_MOTIVOS.map((m) => [m, COBERTURA_MOTIVO_LABEL[m]])
)

function SalvarButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Abrir baixa
    </Button>
  )
}

export function NovaBaixaDialog({
  aberto,
  onClose,
  postos,
  data,
  postoPadrao,
}: {
  aberto: boolean
  onClose: () => void
  postos: { id: string; nome: string }[]
  data: string
  postoPadrao: string | null
}) {
  const router = useRouter()
  const [state, formAction] = useActionState<FormState, FormData>(
    criarVaga,
    undefined
  )

  // Sem a guarda o efeito vira laço: `onClose` nasce inline no pai, então o
  // router.refresh() daqui devolve um `onClose` novo, o efeito roda outra vez e
  // refaz o refresh — indefinidamente.
  const tratado = useRef<FormState>(undefined)

  useEffect(() => {
    if (state?.message !== "ok" || state === tratado.current) return
    tratado.current = state
    toast.success("Baixa aberta. Agora é só escolher quem chamar.")
    router.refresh()
    onClose()
  }, [state, router, onClose])

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marcar baixa</DialogTitle>
          <DialogDescription>
            O posto passa a piscar em vermelho no mapa e fica pronto para receber
            convocações de extra.
          </DialogDescription>
        </DialogHeader>

        {/* key força o formulário a remontar a cada abertura: sem isso, os
            campos voltariam preenchidos com a baixa anterior. */}
        <form key={String(aberto)} action={formAction} className="space-y-4">
          <input type="hidden" name="date" value={data} />

          <div className="space-y-2">
            <Label htmlFor="departmentId">Posto *</Label>
            <Select
              name="departmentId"
              defaultValue={postoPadrao ?? ""}
              items={Object.fromEntries(postos.map((p) => [p.id, p.nome]))}
            >
              <SelectTrigger id="departmentId" className="w-full">
                <SelectValue placeholder="Selecione o posto" />
              </SelectTrigger>
              <SelectContent>
                {postos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state?.errors?.departmentId && (
              <p className="text-sm text-destructive">
                {state.errors.departmentId[0]}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="periodo">Turno *</Label>
              <Select name="periodo" defaultValue="DIURNO" items={PERIODO_ITEMS}>
                <SelectTrigger id="periodo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIURNO">Diurno</SelectItem>
                  <SelectItem value="NOTURNO">Noturno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Select name="motivo" defaultValue="FALTA" items={MOTIVO_ITEMS}>
                <SelectTrigger id="motivo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COBERTURA_MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {COBERTURA_MOTIVO_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="horario">Horário</Label>
            <Input
              id="horario"
              name="horario"
              placeholder="Ex.: 19h às 07h"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              name="observacao"
              rows={2}
              placeholder="O que a pessoa precisa saber ao assumir o posto."
            />
          </div>

          <div className="flex items-center gap-3">
            <SalvarButton />
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
