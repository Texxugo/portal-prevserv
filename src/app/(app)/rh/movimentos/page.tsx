import { BarChart3, Plus } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { canEdit } from "@/lib/permissions"
import { currentCompetencia } from "@/lib/competencia"
import {
  buildTableRows,
  competenciaOptions,
  getMovimentos,
} from "@/lib/movimentos"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { CompetenciaSelect } from "@/components/competencia-select"
import { MovementsTable } from "@/components/rh/movements-table"

export default async function MovimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>
}) {
  const user = await requireSector("rh")
  const editable = canEdit(user.role, "rh")

  const { comp } = await searchParams
  const competencia = comp || currentCompetencia()

  const [movements, options] = await Promise.all([
    getMovimentos(competencia),
    competenciaOptions(competencia),
  ])
  const tableRows = buildTableRows(movements)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de Movimentos"
        description="Faltas, férias, contratações e demissões por competência."
      >
        <CompetenciaSelect value={competencia} options={options} />
        <ButtonLink
          variant="outline"
          href={`/rh/movimentos/resumo?comp=${competencia}`}
          data-tour="mov-resumo"
        >
          <BarChart3 className="size-4" />
          Resumo por colaborador
        </ButtonLink>
        {editable && (
          <ButtonLink href="/rh/movimentos/novo" data-tour="mov-nova">
            <Plus className="size-4" />
            Nova movimentação
          </ButtonLink>
        )}
      </PageHeader>

      <div className="space-y-3" data-tour="mov-tabela">
        <h2 className="text-lg font-medium">Lançamentos</h2>
        <MovementsTable data={tableRows} canEdit={editable} />
      </div>
    </div>
  )
}
