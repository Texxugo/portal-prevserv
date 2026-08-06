"use client"

import { useRef, useState } from "react"
import { Check, Copy, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { corrigirTextoRelatorio } from "@/lib/actions/relatorios"
import {
  comRodapeAutenticidade,
  rodapeAutenticidade,
} from "@/lib/whatsapp/templates"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

// Texto final do relatório para o grupo de WhatsApp.
// `gerado` é montado a partir do formulário e acompanha o que está sendo
// digitado; assim que o usuário edita ou pede correção, `manual` assume e o
// texto para de se mexer sozinho — "Restaurar" volta para o gerado.
export function RelatorioWhatsappCard({
  gerado,
  manual,
  codigo,
  onManualChange,
}: {
  gerado: string
  manual: string | null
  codigo: string | null
  onManualChange: (value: string | null) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  const [corrigindo, setCorrigindo] = useState(false)

  // Corpo editável; o rodapé de autenticidade entra só na saída, para não ser
  // reescrito pela correção nem apagado sem querer na edição.
  const texto = manual ?? gerado
  const textoCompleto = comRodapeAutenticidade(texto, codigo)

  async function handleCopy() {
    let ok = false
    // Em HTTP na LAN (origem insegura) navigator.clipboard não existe
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(textoCompleto)
        ok = true
      } catch {
        ok = false
      }
    }
    if (!ok) {
      // execCommand só copia de um campo visível e selecionado; o textarea de
      // apoio carrega o texto completo (com rodapé) fora da vista.
      const ta = codigo ? fallbackRef.current : ref.current
      if (ta) {
        ta.focus()
        ta.select()
        ta.setSelectionRange(0, ta.value.length)
        try {
          ok = document.execCommand("copy")
        } catch {
          ok = false
        }
      }
    }
    if (ok) {
      toast.success("Relatório copiado.")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Não foi possível copiar. Selecione o texto e use Ctrl+C.")
    }
  }

  async function corrigir() {
    setCorrigindo(true)
    try {
      const result = await corrigirTextoRelatorio(texto)
      if (!result.ok || !result.text) {
        toast.error(result.error || "Não foi possível corrigir o relatório.")
        return
      }
      onManualChange(result.text)
      toast.success("Relatório revisado.")
    } finally {
      setCorrigindo(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatório para o WhatsApp</CardTitle>
        <CardDescription>
          {manual === null
            ? "Gerado a partir do formulário. Edite ou use a Correção antes de copiar."
            : "Texto editado manualmente — não acompanha mais o formulário."}
        </CardDescription>
        <CardAction>
          <div className="flex flex-wrap items-center gap-2">
            {manual !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={corrigindo}
                onClick={() => onManualChange(null)}
              >
                <RotateCcw className="size-4" />
                Restaurar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={corrigindo || texto.trim().length < 10}
              onClick={corrigir}
            >
              {corrigindo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Correção
            </Button>
            <Button type="button" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          ref={ref}
          value={texto}
          onChange={(e) => onManualChange(e.target.value)}
          disabled={corrigindo}
          rows={20}
          className="max-h-[32rem] font-mono text-sm"
        />

        {codigo ? (
          <div className="rounded-lg bg-muted/60 p-3">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {rodapeAutenticidade(codigo)}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Anexado automaticamente ao copiar. Não é editável nem passa pela
              correção — é o que garante que o código chegue íntegro.
            </p>
            {/* espelho invisível p/ o fallback de cópia em origem insegura */}
            <textarea
              ref={fallbackRef}
              value={textoCompleto}
              readOnly
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute size-px opacity-0"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Finalize o relatório para que ele receba o código de verificação no
            rodapé.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
