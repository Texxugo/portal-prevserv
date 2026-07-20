import { Badge } from "@/components/ui/badge"

// Badge do status de hoje do colaborador: de serviço, folga, ou nada (sem escala/jornada).
export function OnDutyBadge({ onDuty }: { onDuty: boolean | null }) {
  if (onDuty == null) return null
  return onDuty ? (
    <Badge
      variant="secondary"
      className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    >
      De serviço hoje
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-muted-foreground">
      Folga hoje
    </Badge>
  )
}
