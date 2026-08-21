"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  BellOff,
  Car,
  Check,
  Loader2,
  MapPinOff,
  PhoneOff,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { confirmarCobertura, convocarParaExtra } from "@/lib/actions/painel"
import { formatDistancia } from "@/lib/geo/distancia"
import type { ColaboradorPainel, ConvitePainel } from "@/lib/painel/dados"
import { podeSerConvocado, SITUACAO_LABEL } from "@/lib/painel/situacao"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconeColaborador } from "@/components/painel/marcadores"
import { cn } from "@/lib/utils"

export type ColaboradorComDistancia = ColaboradorPainel & {
  distanciaKm: number | null
}

const SITUACAO_CLASSE: Record<string, string> = {
  FOLGA: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SEM_ESCALA: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  ESCALADO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  NO_POSTO: "bg-muted text-muted-foreground",
  AFASTADO: "bg-muted text-muted-foreground",
}

// Como cada estado do convite aparece ao lado do nome. O aceite com
// deslocamento é o único que ganha destaque forte: é o que exige providência
// de quem está olhando o painel.
function EstadoDoConvite({ convite }: { convite: ConvitePainel }) {
  if (convite.status === "ACEITO") {
    const esperando = convite.etapa === "AGUARDANDO_DESLOCAMENTO"
    if (esperando) {
      return (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
          <Check /> Aceitou · aguardando resposta sobre deslocamento
        </Badge>
      )
    }
    return convite.precisaDeslocamento ? (
      <Badge className="bg-amber-500 text-white">
        <Car /> Aceitou · precisa de deslocamento
      </Badge>
    ) : (
      <Badge className="bg-emerald-600 text-white">
        <Check /> Aceitou · vai por conta própria
      </Badge>
    )
  }

  if (convite.status === "RECUSADO") {
    return (
      <Badge variant="secondary">
        <X /> Recusou
      </Badge>
    )
  }
  if (convite.status === "OPTOUT") {
    return (
      <Badge variant="secondary">
        <BellOff /> Pediu para não receber mais
      </Badge>
    )
  }
  if (convite.status === "ERRO") {
    return (
      <Badge variant="destructive" title={convite.erro ?? undefined}>
        Falha no envio
      </Badge>
    )
  }
  if (convite.status === "CANCELADO") {
    return <Badge variant="secondary">Convite encerrado</Badge>
  }
  return (
    <Badge variant="outline">
      <Send /> Convite enviado · aguardando resposta
    </Badge>
  )
}

function Linha({
  colaborador,
  convite,
  vagaId,
  selecionado,
  onSelecionar,
}: {
  colaborador: ColaboradorComDistancia
  convite?: ConvitePainel
  vagaId: string | null
  selecionado: boolean
  onSelecionar: (id: string) => void
}) {
  const router = useRouter()
  const [enviando, startEnvio] = useTransition()
  const c = colaborador

  const semTelefone = !c.phone
  const convocavel =
    !!vagaId && !convite && podeSerConvocado(c.situacao) && !c.optOut && !semTelefone

  function convocar() {
    if (!vagaId) return
    startEnvio(async () => {
      const r = await convocarParaExtra(vagaId, c.id)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível enviar o convite.")
        return
      }
      toast.success(`Convite enviado para ${c.nome.split(" ")[0]}.`)
      router.refresh()
    })
  }

  function confirmar() {
    if (!vagaId) return
    startEnvio(async () => {
      const r = await confirmarCobertura(vagaId, c.id)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível confirmar a cobertura.")
        return
      }
      toast.success(`${c.nome.split(" ")[0]} lançado no efetivo como extra.`)
      router.refresh()
    })
  }

  return (
    <li
      className={cn(
        "cursor-pointer space-y-2 px-3 py-2.5 transition-colors hover:bg-muted/60",
        selecionado && "bg-muted"
      )}
      onClick={() => onSelecionar(c.id)}
    >
      <div className="flex items-start gap-2.5">
        <IconeColaborador
          sexo={c.sexo}
          santo={c.santo}
          situacao={c.situacao}
          tamanho={26}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{c.nome}</span>
            {c.santo && (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-400"
                title="Registrado na Santo e Bueno Vigilância"
              >
                <ShieldCheck /> Santo
              </Badge>
            )}
            {c.optOut && (
              <Badge variant="secondary" title="Pediu para não receber convites por WhatsApp">
                <BellOff /> Não perturbar
              </Badge>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                SITUACAO_CLASSE[c.situacao]
              )}
            >
              {SITUACAO_LABEL[c.situacao]}
            </span>
            {c.departmentNome && <span className="truncate">{c.departmentNome}</span>}
            {c.distanciaKm !== null && (
              <span className="font-medium text-foreground">
                {formatDistancia(c.distanciaKm)}
              </span>
            )}
            {c.lat === null && (
              <span className="inline-flex items-center gap-1">
                <MapPinOff className="size-3" /> sem localização
              </span>
            )}
            {semTelefone && (
              <span className="inline-flex items-center gap-1">
                <PhoneOff className="size-3" /> sem telefone
              </span>
            )}
          </div>
        </div>
      </div>

      {convite && (
        <div className="pl-9">
          <EstadoDoConvite convite={convite} />
        </div>
      )}

      {(convocavel || (convite?.status === "ACEITO" && vagaId)) && (
        <div className="flex flex-wrap gap-2 pl-9" onClick={(e) => e.stopPropagation()}>
          {convocavel && (
            <Button size="sm" disabled={enviando} onClick={convocar}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Chamar para extra
            </Button>
          )}
          {convite?.status === "ACEITO" && (
            <Button size="sm" variant="outline" disabled={enviando} onClick={confirmar}>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserCheck className="size-4" />
              )}
              Confirmar cobertura
            </Button>
          )}
        </div>
      )}

      {/* Motivo de não dar para convocar, dito na hora — evita o operador
          procurar o botão que não existe. */}
      {vagaId && !convite && !convocavel && (
        <p className="pl-9 text-xs text-muted-foreground">
          {c.optOut
            ? "Não recebe convites por WhatsApp."
            : semTelefone
              ? "Sem telefone no cadastro."
              : `Indisponível hoje (${SITUACAO_LABEL[c.situacao].toLowerCase()}).`}
        </p>
      )}
    </li>
  )
}

export function PainelColaboradores({
  colaboradores,
  convitesPorEmployee,
  vagaId,
  selecionado,
  onSelecionar,
}: {
  colaboradores: ColaboradorComDistancia[]
  convitesPorEmployee: Map<string, ConvitePainel>
  vagaId: string | null
  selecionado: string | null
  onSelecionar: (id: string) => void
}) {
  if (colaboradores.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        Nenhum colaborador com os filtros atuais.
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {colaboradores.map((c) => (
        <Linha
          key={c.id}
          colaborador={c}
          convite={convitesPorEmployee.get(c.id)}
          vagaId={vagaId}
          selecionado={c.id === selecionado}
          onSelecionar={onSelecionar}
        />
      ))}
    </ul>
  )
}
