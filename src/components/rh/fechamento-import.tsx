"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import {
  importarEspelhoFechamento,
  type FechamentoImportState,
} from "@/lib/actions/fechamento"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Upload className="size-4" />
      )}
      Importar espelho
    </Button>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

export function FechamentoImport({ competencia }: { competencia: string }) {
  const router = useRouter()
  const [state, action] = useActionState<FechamentoImportState, FormData>(
    importarEspelhoFechamento,
    undefined
  )

  useEffect(() => {
    if (state?.status === "ok") {
      const r = state.resumo
      toast.success(
        `Importado: ${r?.processados ?? 0} colaborador(es), ${r?.ocorrencias ?? 0} ocorrência(s).`
      )
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competencia" value={competencia} />
      <div className="space-y-2">
        <Label htmlFor="file">Arquivo do espelho (.txt)</Label>
        <Input id="file" name="file" type="file" accept=".txt" required />
      </div>
      <SubmitBtn />
      {state?.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      {state?.status === "ok" && state.resumo && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Período {state.resumo.periodo} · {state.resumo.processados}{" "}
            processado(s) · {state.resumo.ocorrencias} ocorrência(s)
            {state.resumo.encerradosPulados > 0 &&
              ` · ${state.resumo.encerradosPulados} já encerrado(s)`}
          </p>
          {state.resumo.duplicado && (
            <Aviso>
              Este mesmo arquivo já havia sido importado nesta competência. Reimportar o
              mesmo período não duplica batidas — se a intenção era outro arquivo,
              confira qual foi enviado.
            </Aviso>
          )}
          {state.resumo.pendencias > 0 && (
            <Aviso>
              {state.resumo.pendencias} linha(s) do arquivo não entraram no espelho e
              foram para a fila de pendências de importação, logo abaixo. As batidas
              ficaram guardadas — resolver a pendência aplica direto, sem reimportar.
            </Aviso>
          )}
        </div>
      )}
    </form>
  )
}
