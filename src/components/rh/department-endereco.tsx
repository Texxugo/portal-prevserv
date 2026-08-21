"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Loader2, MapPin, MapPinOff, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { geocodificarLote, salvarEnderecoPosto } from "@/lib/actions/geo"
import { enderecoResumo } from "@/lib/geo/endereco"
import type { FormState } from "@/lib/form"
import { EnderecoFields } from "@/components/geo/endereco-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Endereço do posto: o que transforma o departamento em alfinete no painel
// operacional. Fica no cadastro de departamentos porque é lá que o posto nasce.

export type DeptEndereco = {
  id: string
  name: string
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  lat: number | null
  geocodeStatus: string | null
}

function SalvarButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Salvar e localizar no mapa
    </Button>
  )
}

export function EnderecoField({
  dept,
  onEditar,
}: {
  dept: DeptEndereco
  onEditar: (dept: DeptEndereco) => void
}) {
  const resumo = enderecoResumo(dept)
  const localizado = dept.lat !== null

  return (
    <div className="flex items-start justify-between gap-3">
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        {localizado ? (
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <MapPinOff className="mt-0.5 size-3.5 shrink-0" />
        )}
        <span>
          {resumo || "Sem endereço cadastrado"}
          {resumo && !localizado && (
            <span className="text-amber-600">
              {" "}
              · não localizado no mapa
              {dept.geocodeStatus === "NAO_ENCONTRADO" && " (confira rua e número)"}
            </span>
          )}
        </span>
      </p>
      <Button type="button" variant="outline" size="sm" onClick={() => onEditar(dept)}>
        Endereço
      </Button>
    </div>
  )
}

export function EnderecoDialog({
  dept,
  onClose,
}: {
  dept: DeptEndereco | null
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState<FormState, FormData>(
    // O id vai no bind porque o diálogo é remontado a cada posto escolhido.
    salvarEnderecoPosto.bind(null, dept?.id ?? ""),
    undefined
  )

  // Guarda o resultado já tratado. Sem isso o efeito vira laço: `onClose` nasce
  // inline no pai, então o router.refresh() daqui devolve um `onClose` novo, o
  // efeito roda de novo e refaz o refresh — sem parar nunca.
  const tratado = useRef<FormState>(undefined)

  useEffect(() => {
    if (!state?.message || state === tratado.current) return
    tratado.current = state

    if (state.message === "ok") {
      toast.success("Endereço salvo e localizado no mapa.")
      router.refresh()
      onClose()
      return
    }
    toast.warning(state.message)
    router.refresh()
  }, [state, router, onClose])

  return (
    <Dialog open={dept !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Endereço de {dept?.name}</DialogTitle>
          <DialogDescription>
            Ao salvar, o portal procura a coordenada no OpenStreetMap e o posto
            passa a aparecer no painel operacional.
          </DialogDescription>
        </DialogHeader>

        {dept && (
          <form action={formAction} className="space-y-5">
            <EnderecoFields defaults={dept} errors={state?.errors} />
            <div className="flex items-center gap-3">
              <SalvarButton />
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Cadastro antigo tem endereço mas não tem coordenada. Este botão resolve em
 * rodadas curtas — o Nominatim aceita 1 consulta por segundo, então cada clique
 * trata um punhado e informa quanto ainda falta.
 */
export function LocalizarPendentes({
  alvo,
  pendentes,
}: {
  alvo: "POSTOS" | "COLABORADORES"
  pendentes: number
}) {
  const router = useRouter()
  const [restantes, setRestantes] = useState(pendentes)
  const [rodando, startRodada] = useTransition()

  if (restantes === 0) return null

  const substantivo = alvo === "POSTOS" ? "posto(s)" : "colaborador(es)"

  function rodar() {
    startRodada(async () => {
      const r = await geocodificarLote(alvo)
      if (!r.ok) {
        toast.error(r.error || "Falha ao localizar.")
        return
      }
      setRestantes(r.pendentes ?? 0)
      const { ok = 0, falhas = 0 } = r.resultado ?? {}
      if (ok === 0 && falhas === 0) {
        toast.info("Nada a localizar nesta rodada.")
      } else {
        toast.success(
          `${ok} localizado(s)${falhas ? `, ${falhas} sem resultado` : ""}.` +
            (r.pendentes ? ` Ainda faltam ${r.pendentes}.` : "")
        )
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <p className="text-sm">
        <strong>{restantes}</strong> {substantivo} com endereço, mas ainda sem
        posição no mapa.
      </p>
      <Button type="button" variant="outline" size="sm" disabled={rodando} onClick={rodar}>
        {rodando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wand2 className="size-4" />
        )}
        Localizar agora
      </Button>
    </div>
  )
}
