import Link from "next/link"
import { ClipboardCheck, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type PontoAba = "importar" | "tratar"

// Navegação entre as duas visões do ponto. Estado na URL (?aba=), não no cliente:
// assim o link é compartilhável e o servidor só busca o que a visão precisa.
export function PontoTabs({
  aba,
  competencia,
  badgeImportar,
  badgeTratar,
}: {
  aba: PontoAba
  competencia: string
  badgeImportar: number
  badgeTratar: number
}) {
  const itens = [
    {
      key: "importar" as const,
      label: "Importar e acompanhar",
      icon: Upload,
      badge: badgeImportar,
    },
    {
      key: "tratar" as const,
      label: "Tratar e encerrar",
      icon: ClipboardCheck,
      badge: badgeTratar,
    },
  ]

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1"
      data-tour="ponto-abas"
    >
      {itens.map((item) => {
        const ativo = aba === item.key
        return (
          <Link
            key={item.key}
            href={`/rh/ponto?comp=${competencia}&aba=${item.key}`}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
            {item.badge > 0 && (
              <Badge variant="secondary" className="ml-1">
                {item.badge}
              </Badge>
            )}
          </Link>
        )
      })}
    </div>
  )
}
