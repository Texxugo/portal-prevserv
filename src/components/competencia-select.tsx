"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Seletor de competência genérico: troca o parâmetro `?comp=` preservando a rota
// e os demais parâmetros. Reutilizável por qualquer página que filtre por competência.
export function CompetenciaSelect({
  value,
  options,
}: {
  value: string
  options: { value: string; label: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(next: string | null) {
    if (!next) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("comp", next)
    router.push(`${pathname}?${params.toString()}`)
  }

  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))

  return (
    <Select value={value} onValueChange={handleChange} items={items}>
      <SelectTrigger className="w-44" aria-label="Competência">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
