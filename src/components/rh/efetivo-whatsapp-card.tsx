"use client"

import { useRef, useState } from "react"
import { Check, Copy, Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { enviarEfetivoAoGrupo } from "@/lib/actions/efetivos"
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

export function EfetivoWhatsappCard({
  periodo,
  message,
  departmentId,
  temGrupo,
}: {
  periodo: string
  message: string
  departmentId: string
  temGrupo: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  // editável: dá para completar observações à mão antes de copiar
  const [texto, setTexto] = useState(message)
  const [msgAnterior, setMsgAnterior] = useState(message)
  // efetivo mudou (novo cadastro / troca de data) → recarrega o texto base
  if (message !== msgAnterior) {
    setMsgAnterior(message)
    setTexto(message)
    setEnviado(false)
  }

  async function handleSend() {
    setEnviando(true)
    try {
      const result = await enviarEfetivoAoGrupo(departmentId, texto)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível enviar ao grupo.")
        return
      }
      // marca a mensagem como já enviada — o efetivo muda ao longo do dia e é
      // fácil reenviar o mesmo texto sem perceber
      setEnviado(true)
      toast.success("Efetivo enviado ao grupo do posto.")
    } finally {
      setEnviando(false)
    }
  }

  async function handleCopy() {
    let ok = false
    // Em HTTP na LAN (origem insegura) navigator.clipboard não existe
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(texto)
        ok = true
      } catch {
        ok = false
      }
    }
    if (!ok) {
      const ta = ref.current
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
      toast.success("Mensagem copiada.")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Não foi possível copiar. Selecione o texto e use Ctrl+C.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Efetivo {periodo === "NOTURNO" ? "noturno" : "diurno"}
        </CardTitle>
        <CardDescription>
          {temGrupo
            ? "Envie direto ao grupo do posto ou copie. O texto é editável antes de enviar."
            : "Copie e cole no grupo do posto. O texto é editável antes de copiar."}
        </CardDescription>
        <CardAction>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            {temGrupo && (
              <Button
                type="button"
                size="sm"
                disabled={enviando || texto.trim().length < 10}
                onClick={handleSend}
              >
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : enviado ? (
                  <Check className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
                {enviado ? "Enviado" : "Enviar ao grupo"}
              </Button>
            )}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Textarea
          ref={ref}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="max-h-72 font-mono text-sm"
        />
      </CardContent>
    </Card>
  )
}
