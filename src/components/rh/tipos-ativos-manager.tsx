"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { setTiposAtivos } from "@/lib/actions/fechamento"
import {
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import { Label } from "@/components/ui/label"

const TIPOS = Object.keys(OCORRENCIA_LABEL) as OcorrenciaTipo[]

export function TiposAtivosManager({ ativos }: { ativos: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(ativos))
  const [pending, start] = useTransition()

  function toggle(tipo: string) {
    const next = new Set(selected)
    if (next.has(tipo)) next.delete(tipo)
    else next.add(tipo)
    setSelected(next)
    start(async () => {
      await setTiposAtivos([...next])
      toast.success("Tipos atualizados.")
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Tipos que contam</Label>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-2">
        {TIPOS.map((tipo) => {
          const on = selected.has(tipo)
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => toggle(tipo)}
              className={
                on
                  ? "rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
                  : "rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground ring-1 ring-foreground/10"
              }
            >
              {OCORRENCIA_LABEL[tipo]}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Tipos desligados são ignorados na próxima importação.
      </p>
    </div>
  )
}
