"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"

// Filtro de data genérico: troca o parâmetro `?date=` (YYYY-MM-DD) preservando a
// rota e os demais parâmetros. Reutilizável por qualquer página que filtre por dia.
export function DateFilter({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(next: string) {
    if (!next) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", next)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Input
      type="date"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="w-44"
      aria-label="Data"
    />
  )
}
