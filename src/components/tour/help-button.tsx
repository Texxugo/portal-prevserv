"use client"

import { HelpCircle } from "lucide-react"

import { useTour } from "./tour-provider"
import { Button } from "@/components/ui/button"

// "?" do header: abre o tutorial guiado da página atual (oculto sem roteiro)
export function HelpButton() {
  const { hasTour, start } = useTour()
  if (!hasTour) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Abrir tutorial da página"
      onClick={start}
    >
      <HelpCircle className="size-4" />
    </Button>
  )
}
