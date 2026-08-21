"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlarmClock, Check, CircleAlert, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { confirmarEfetivoConferido } from "@/lib/actions/efetivos"
import {
  EFETIVO_JANELAS,
  estadoDoTurno,
  inicioDaJanela,
  labelDaJanela,
  PERIODO_LABEL,
  type EstadoTurno,
} from "@/lib/efetivo-cobertura"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/button-link"

export type TurnoLembrete = {
  periodo: string
  total: number
  atualizadoEm: string | null // ISO
  confirmadoEm: string | null // ISO
  confirmadoPor: string | null
}

/**
 * Lembrete de conferência do efetivo nas janelas de 07h e 17h.
 *
 * O relógio é o do navegador, não o do servidor: a página é renderizada uma vez
 * e ficaria com a janela errada se o horário viesse pronto do servidor — quem
 * deixa a tela aberta às 06h55 veria o aviso só depois de recarregar. Por isso
 * o componente é cliente e reavalia a cada minuto.
 */
export function EfetivoLembrete({
  departmentId,
  dateStr,
  turnos,
  canEdit,
}: {
  departmentId: string
  dateStr: string
  turnos: TurnoLembrete[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [agora, setAgora] = useState<Date | null>(null)
  const [salvando, startSalvar] = useTransition()
  const [alvo, setAlvo] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => setAgora(new Date())
    tick()
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])

  // Até montar não há relógio confiável (o HTML do servidor não pode divergir
  // do cliente na hidratação). O lembrete só vale para o dia de hoje.
  if (!agora) return null
  const hoje =
    dateStr ===
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`
  if (!hoje) return null

  const linhas = EFETIVO_JANELAS.map((janela) => {
    const turno = turnos.find((t) => t.periodo === janela.periodo)
    const dados: TurnoLembrete = turno ?? {
      periodo: janela.periodo,
      total: 0,
      atualizadoEm: null,
      confirmadoEm: null,
      confirmadoPor: null,
    }
    return {
      ...dados,
      hora: labelDaJanela(janela.periodo),
      estado: estadoDoTurno({
        total: dados.total,
        atualizadoEm: dados.atualizadoEm,
        confirmadoEm: dados.confirmadoEm,
        inicioJanela: inicioDaJanela(dateStr, janela.hora),
        agora,
      }),
    }
  }).filter((l) => l.estado !== "FUTURO")

  if (linhas.length === 0) return null

  const pendentes = linhas.filter((l) => l.estado !== "CONFERIDO")

  function confirmar(periodo: string) {
    setAlvo(periodo)
    startSalvar(async () => {
      const result = await confirmarEfetivoConferido(
        departmentId,
        dateStr,
        periodo
      )
      setAlvo(null)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível confirmar.")
        return
      }
      toast.success(
        `Efetivo ${PERIODO_LABEL[periodo]?.toLowerCase() ?? periodo} conferido.`
      )
      router.refresh()
    })
  }

  return (
    <section
      className={
        pendentes.length > 0
          ? "space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          : "space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      }
    >
      <div className="flex items-center gap-2">
        <AlarmClock
          className={
            pendentes.length > 0
              ? "size-4 text-amber-700 dark:text-amber-400"
              : "size-4 text-muted-foreground"
          }
        />
        <h2 className="text-sm font-medium">Conferência do efetivo</h2>
        <span className="text-xs text-muted-foreground">
          lembrete às 07:00 e 17:00
        </span>
      </div>

      <ul className="space-y-2">
        {linhas.map((l) => (
          <li
            key={l.periodo}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          >
            <Situacao estado={l.estado} />
            <span className="font-medium">
              {PERIODO_LABEL[l.periodo] ?? l.periodo}
            </span>
            <span className="text-muted-foreground">
              {textoDaLinha(l.estado, l.total, l.hora, l.confirmadoPor)}
            </span>
            {canEdit && l.estado !== "CONFERIDO" && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={salvando}
                  onClick={() => confirmar(l.periodo)}
                >
                  {salvando && alvo === l.periodo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {l.total === 0 ? "Sem efetivo neste turno" : "Sem novidades"}
                </Button>
                <ButtonLink
                  size="sm"
                  href={`/rh/efetivos/${departmentId}/novo?date=${dateStr}&periodo=${l.periodo}`}
                >
                  Atualizar
                </ButtonLink>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function textoDaLinha(
  estado: EstadoTurno,
  total: number,
  hora: string,
  confirmadoPor: string | null
): string {
  if (estado === "CONFERIDO") {
    return confirmadoPor
      ? `conferido por ${confirmadoPor}.`
      : total === 0
        ? "sem efetivo lançado."
        : `${total} lançado(s) — atualizado depois das ${hora}.`
  }
  if (estado === "SEM_CADASTRO") {
    return `nenhum efetivo lançado até as ${hora}.`
  }
  return `${total} lançado(s), sem alteração desde as ${hora}.`
}

function Situacao({ estado }: { estado: EstadoTurno }) {
  if (estado === "CONFERIDO") {
    return <Check className="size-4 shrink-0 text-primary" />
  }
  if (estado === "SEM_CADASTRO") {
    return <CircleAlert className="size-4 shrink-0 text-destructive" />
  }
  return (
    <CircleAlert className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
  )
}
