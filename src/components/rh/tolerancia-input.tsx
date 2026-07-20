"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { setTolerancia } from "@/lib/actions/fechamento"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ToleranciaInput({ value }: { value: number }) {
  const [v, setV] = useState(String(value))
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      await setTolerancia(Number(v))
      toast.success("Tolerância salva.")
    })
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="tol">Tolerância (min)</Label>
        <Input
          id="tol"
          type="number"
          min={0}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-28"
        />
      </div>
      <Button variant="outline" onClick={save} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Salvar
      </Button>
    </div>
  )
}
