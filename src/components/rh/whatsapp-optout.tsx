"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { BellOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { reativarWhatsapp } from "@/lib/actions/painel"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"

/**
 * O "não receber mais mensagens" veio do próprio colaborador pelo WhatsApp, e é
 * ele quem tem de pedir de volta. O botão existe para registrar esse pedido —
 * por isso o aviso explícito antes.
 */
export function WhatsappOptOut({
  employeeId,
  optOut,
  desde,
}: {
  employeeId: string
  optOut: boolean
  desde: string | null
}) {
  const router = useRouter()
  const [pendente, start] = useTransition()

  if (!optOut) return null

  function reativar() {
    start(async () => {
      const r = await reativarWhatsapp(employeeId)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível reativar.")
        return
      }
      toast.success("Colaborador volta a receber convites de extra.")
      router.refresh()
    })
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <BellOff className="size-4 text-amber-600" />
          Não recebe convites de extra
        </p>
        <p className="text-xs text-muted-foreground">
          Pedido feito pelo próprio colaborador no WhatsApp
          {desde ? ` em ${formatDateTime(desde)}` : ""}. Só reative se ele pedir.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={reativar}>
        {pendente && <Loader2 className="size-4 animate-spin" />}
        Voltar a enviar convites
      </Button>
    </div>
  )
}
