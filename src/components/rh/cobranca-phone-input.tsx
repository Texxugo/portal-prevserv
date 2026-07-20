"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { setCobrancaPhone } from "@/lib/actions/notificacoes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CobrancaPhoneInput({ value }: { value: string }) {
  const [v, setV] = useState(value)
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      const result = await setCobrancaPhone(v)
      if (result.ok) {
        toast.success(
          v.trim() ? "Telefone de cobrança salvo." : "Notificações por WhatsApp desativadas."
        )
      } else {
        toast.error(result.error ?? "Não foi possível salvar.")
      }
    })
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="cobranca-phone">WhatsApp de cobrança</Label>
        <Input
          id="cobranca-phone"
          type="tel"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="DDD + número (ex.: 11999998888)"
          className="w-64"
        />
      </div>
      <Button variant="outline" onClick={save} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Salvar
      </Button>
    </div>
  )
}
