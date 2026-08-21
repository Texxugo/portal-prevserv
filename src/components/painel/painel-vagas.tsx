"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Car, Check, Loader2, Lightbulb, X } from "lucide-react"
import { toast } from "sonner"

import { cancelarVaga, criarVagaDaSugestao } from "@/lib/actions/painel"
import type { SugestaoBaixa, VagaPainel } from "@/lib/painel/dados"
import { COBERTURA_MOTIVO_LABEL, type CoberturaMotivo } from "@/lib/schemas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LIMITE_SUGESTOES = 5

const PERIODO_LABEL: Record<string, string> = {
  DIURNO: "Diurno",
  NOTURNO: "Noturno",
}

function motivoLabel(motivo: string): string {
  return COBERTURA_MOTIVO_LABEL[motivo as CoberturaMotivo] ?? motivo
}

/** Resumo do que já aconteceu com os convites — é o que o operador acompanha. */
function ResumoConvites({ vaga }: { vaga: VagaPainel }) {
  const aceitos = vaga.convites.filter((c) => c.status === "ACEITO")
  const aguardando = vaga.convites.filter((c) => c.status === "ENVIADO")
  const recusas = vaga.convites.filter((c) => c.status === "RECUSADO").length

  if (vaga.convites.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Ninguém convocado ainda.</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {aceitos.map((c) => (
        <Badge
          key={c.id}
          className={cn(
            "max-w-full",
            c.precisaDeslocamento
              ? "bg-amber-500 text-white"
              : "bg-emerald-600 text-white"
          )}
        >
          {c.precisaDeslocamento ? <Car /> : <Check />}
          <span className="truncate">
            {c.employeeNome.split(" ")[0]}
            {c.precisaDeslocamento
              ? " · precisa de deslocamento"
              : c.etapa === "AGUARDANDO_DESLOCAMENTO"
                ? " · aceitou"
                : " · por conta própria"}
          </span>
        </Badge>
      ))}
      {aguardando.length > 0 && (
        <Badge variant="outline">{aguardando.length} aguardando resposta</Badge>
      )}
      {recusas > 0 && <Badge variant="secondary">{recusas} recusa(s)</Badge>}
    </div>
  )
}

export function CartaoVaga({
  vaga,
  selecionada,
  mostrarPosto,
  onSelecionar,
}: {
  vaga: VagaPainel
  selecionada: boolean
  mostrarPosto?: boolean
  onSelecionar: (id: string) => void
}) {
  const router = useRouter()
  const [pendente, start] = useTransition()
  const aberta = vaga.status === "ABERTA"

  function cancelar() {
    start(async () => {
      const r = await cancelarVaga(vaga.id)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível cancelar.")
        return
      }
      toast.success("Baixa cancelada.")
      router.refresh()
    })
  }

  return (
    <div
      onClick={() => aberta && onSelecionar(vaga.id)}
      className={cn(
        "space-y-2 rounded-lg border p-3 transition-colors",
        aberta && "cursor-pointer hover:bg-muted/50",
        selecionada
          ? "border-destructive/60 bg-destructive/5"
          : aberta
            ? "border-destructive/25"
            : "border-border bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {aberta ? (
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
            ) : (
              <Check className="size-4 shrink-0 text-emerald-600" />
            )}
            <span className="truncate">
              {mostrarPosto ? `${vaga.postoNome} · ` : ""}
              {PERIODO_LABEL[vaga.periodo] ?? vaga.periodo}
              {vaga.horario ? ` · ${vaga.horario}` : ""}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {motivoLabel(vaga.motivo)}
            {vaga.ausenteNome ? ` — cobrindo ${vaga.ausenteNome}` : ""}
          </p>
        </div>

        {aberta ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Cancelar baixa"
            disabled={pendente}
            onClick={(e) => {
              e.stopPropagation()
              cancelar()
            }}
          >
            {pendente ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </Button>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            Coberta
          </Badge>
        )}
      </div>

      {vaga.observacao && (
        <p className="text-xs text-muted-foreground">{vaga.observacao}</p>
      )}

      {vaga.status === "PREENCHIDA" ? (
        <p className="text-xs">
          Coberta por <strong>{vaga.cobertaPorNome}</strong> — lançada no efetivo
          como extra.
        </p>
      ) : (
        <ResumoConvites vaga={vaga} />
      )}

      {aberta && !selecionada && (
        <p className="text-xs text-muted-foreground">
          Clique para escolher quem chamar.
        </p>
      )}
    </div>
  )
}

/**
 * Faltas e férias do dia que ainda não viraram baixa. Ficam como sugestão
 * porque nem toda ausência precisa de reposição — quem decide é o operador.
 */
export function Sugestoes({
  sugestoes,
  data,
}: {
  sugestoes: SugestaoBaixa[]
  data: string
}) {
  const router = useRouter()
  const [pendente, start] = useTransition()
  // Sem posto escolhido são dezenas de ausências, e a lista inteira empurraria
  // os colaboradores para fora da tela. Mostra as primeiras e abre sob demanda.
  const [todas, setTodas] = useState(false)

  if (sugestoes.length === 0) return null

  const visiveis = todas ? sugestoes : sugestoes.slice(0, LIMITE_SUGESTOES)
  const ocultas = sugestoes.length - visiveis.length

  function abrir(movementId: string, periodo: "DIURNO" | "NOTURNO") {
    start(async () => {
      const r = await criarVagaDaSugestao({ movementId, periodo, dateStr: data })
      if (!r.ok) {
        toast.error(r.error || "Não foi possível abrir a baixa.")
        return
      }
      toast.success("Baixa aberta no posto.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Lightbulb className="size-4 text-amber-600" />
        Ausências sem baixa aberta ({sugestoes.length})
      </p>

      <ul className="space-y-2">
        {visiveis.map((s) => (
          <li key={s.movementId} className="space-y-1.5">
            <p className="text-sm">
              <strong>{s.employeeNome}</strong>{" "}
              <span className="text-muted-foreground">
                — {s.tipo === "FERIAS" ? "férias" : "falta"} em {s.postoNome}
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pendente}
                onClick={() => abrir(s.movementId, "DIURNO")}
              >
                {pendente && <Loader2 className="size-4 animate-spin" />}
                Abrir baixa · diurno
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pendente}
                onClick={() => abrir(s.movementId, "NOTURNO")}
              >
                Abrir baixa · noturno
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {sugestoes.length > LIMITE_SUGESTOES && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => setTodas((v) => !v)}
        >
          {todas ? "Mostrar menos" : `Ver mais ${ocultas}`}
        </Button>
      )}
    </div>
  )
}
