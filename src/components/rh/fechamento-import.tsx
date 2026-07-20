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

function NameList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null
  return (
    <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" />
        {title}
      </p>
      <ul className="mt-1 list-inside list-disc">
        {names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
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
      <input type="hidden" name="origem" value="FECHAMENTO" />
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
            {state.resumo.processados} processado(s) · {state.resumo.ocorrencias}{" "}
            ocorrência(s)
            {state.resumo.encerradosPulados > 0 &&
              ` · ${state.resumo.encerradosPulados} já encerrado(s)`}
          </p>
          <NameList
            title="Não encontrados no cadastro (corrija a matrícula ou cadastre o colaborador):"
            names={state.resumo.naoEncontradosNomes}
          />
          <NameList
            title="Sem jornada/escala cadastrada (cadastre a jornada e importe de novo):"
            names={state.resumo.semJornadaNomes}
          />
        </div>
      )}
    </form>
  )
}
