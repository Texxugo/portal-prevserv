"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  Copy,
  Loader2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Unlock,
} from "lucide-react"
import { toast } from "sonner"

import {
  finalizarRelatorio,
  reabrirRelatorio,
  reenviarRelatorioAoGrupo,
} from "@/lib/actions/relatorios"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Fechamento do relatório e código de autenticidade.
// O código só existe com o relatório finalizado; reabrir apaga o código, e o
// próximo fechamento emite outro — é isso que impede reaproveitar texto antigo.
export function RelatorioFinalizarCard({
  relatorioId,
  status,
  codigo,
  finalizadoAt,
  finalizadoPorNome,
  temGrupo,
  enviadoAt,
  enviadoErro,
}: {
  relatorioId: string | null
  status: string
  codigo: string | null
  finalizadoAt: Date | null
  finalizadoPorNome: string | null
  temGrupo: boolean
  enviadoAt: Date | null
  enviadoErro: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const finalizado = status === "FINALIZADO" && !!codigo

  function finalizar() {
    if (!relatorioId) return
    startTransition(async () => {
      const result = await finalizarRelatorio(relatorioId)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível finalizar o relatório.")
        return
      }
      // o fechamento vale mesmo se o envio falhar — avisa sem desfazer nada
      if (result.envio?.enviado) {
        toast.success(`Relatório finalizado e enviado ao grupo. Código ${result.id}.`)
      } else if (result.envio?.erro) {
        toast.warning(
          `Relatório finalizado (código ${result.id}), mas o envio ao grupo falhou: ${result.envio.erro}`
        )
      } else {
        toast.success(`Relatório finalizado. Código ${result.id}.`)
      }
      router.refresh()
    })
  }

  function reenviar() {
    if (!relatorioId) return
    startTransition(async () => {
      const result = await reenviarRelatorioAoGrupo(relatorioId)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível enviar ao grupo.")
        return
      }
      toast.success("Relatório enviado ao grupo.")
      router.refresh()
    })
  }

  function reabrir() {
    if (!relatorioId) return
    startTransition(async () => {
      const result = await reabrirRelatorio(relatorioId)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível reabrir o relatório.")
        return
      }
      toast.success("Relatório reaberto. O código anterior deixou de valer.")
      router.refresh()
    })
  }

  async function copiarCodigo() {
    if (!codigo) return
    try {
      await navigator.clipboard.writeText(codigo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Código copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e use Ctrl+C.")
    }
  }

  if (!relatorioId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Autenticidade</CardTitle>
          <CardDescription>
            Salve o relatório para poder finalizá-lo e gerar o código de
            verificação.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autenticidade</CardTitle>
        <CardDescription>
          {finalizado
            ? "Relatório fechado. O código abaixo comprova que este texto saiu do sistema."
            : temGrupo
              ? "Ao finalizar, o relatório é travado, recebe um código único e é enviado ao grupo do posto."
              : "Ao finalizar, o relatório é travado e recebe um código único de verificação."}
        </CardDescription>
        <CardAction>
          {finalizado ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={reabrir}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unlock className="size-4" />
              )}
              Reabrir
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={pending} onClick={finalizar}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              {temGrupo ? "Finalizar e enviar ao grupo" : "Finalizar relatório"}
            </Button>
          )}
        </CardAction>
      </CardHeader>

      {finalizado && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="size-5 text-primary" />
            <code className="rounded-lg bg-muted px-3 py-1.5 font-mono text-lg tracking-widest">
              {codigo}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copiarCodigo}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copiado!" : "Copiar código"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Finalizado por {finalizadoPorNome ?? "—"}
            {finalizadoAt ? ` em ${formatDateTime(finalizadoAt)}` : ""}. Confira
            um código recebido em{" "}
            <Link
              href="/rh/relatorios/verificar"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Verificar relatório
            </Link>
            .
          </p>

          {temGrupo &&
            (enviadoAt ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="size-4 text-primary" />
                Enviado ao grupo do posto em {formatDateTime(enviadoAt)}.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-destructive/10 p-3 ring-1 ring-destructive/30">
                <p className="flex-1 text-sm">
                  <span className="font-medium text-destructive">
                    Não foi enviado ao grupo.
                  </span>{" "}
                  {enviadoErro ?? "O disparo não chegou a ser feito."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={reenviar}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Reenviar
                </Button>
              </div>
            ))}

          {!temGrupo && (
            <p className="text-sm text-muted-foreground">
              Este posto não tem grupo de WhatsApp cadastrado — o relatório
              precisa ser copiado à mão. Cadastre o grupo em{" "}
              <Link
                href="/rh/departamentos"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Departamentos
              </Link>{" "}
              para o envio passar a ser automático.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
