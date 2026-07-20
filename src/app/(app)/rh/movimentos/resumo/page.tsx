import { ArrowLeft } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { currentCompetencia } from "@/lib/competencia"
import {
  buildMatrixRows,
  competenciaOptions,
  getMovimentos,
} from "@/lib/movimentos"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { CompetenciaSelect } from "@/components/competencia-select"
import { MovementsMatrix } from "@/components/rh/movements-matrix"

export default async function ResumoMovimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>
}) {
  await requireSector("rh")

  const { comp } = await searchParams
  const competencia = comp || currentCompetencia()

  const [movements, options] = await Promise.all([
    getMovimentos(competencia),
    competenciaOptions(competencia),
  ])
  const matrixRows = buildMatrixRows(movements)

  return (
    <div className="space-y-3">
      <PageHeader
        title="Resumo por colaborador"
        description="Contagem de movimentações por colaborador na competência."
      >
        <CompetenciaSelect value={competencia} options={options} />
        <ButtonLink variant="outline" href={`/rh/movimentos?comp=${competencia}`}>
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <MovementsMatrix rows={matrixRows} />
    </div>
  )
}
