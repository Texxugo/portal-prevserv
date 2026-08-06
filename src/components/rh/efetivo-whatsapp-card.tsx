"use client"

import { useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

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
}: {
  periodo: string
  message: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  // editável: dá para completar observações à mão antes de copiar
  const [texto, setTexto] = useState(message)
  const [msgAnterior, setMsgAnterior] = useState(message)
  // efetivo mudou (novo cadastro / troca de data) → recarrega o texto base
  if (message !== msgAnterior) {
    setMsgAnterior(message)
    setTexto(message)
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
          Copie e cole no grupo do posto. O texto é editável antes de copiar.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
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
