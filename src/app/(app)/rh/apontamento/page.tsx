import { Download } from "lucide-react"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { competenciaSelectOptions, currentCompetencia } from "@/lib/competencia"
import { PageHeader } from "@/components/layout/page-header"
import { CompetenciaSelect } from "@/components/competencia-select"
import { Button } from "@/components/ui/button"
import {
  ApontamentoGrid,
  type ApontamentoRow,
  type FieldValues,
} from "@/components/rh/apontamento-grid"

type Apontamento = NonNullable<
  Awaited<ReturnType<typeof prisma.apontamento.findFirst>>
>

const s = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : String(n)

function toFieldValues(a: Apontamento | undefined): FieldValues {
  return {
    total: String(a?.total ?? 0),
    valeTransporte: String(a?.valeTransporte ?? 0),
    valeRefeicao: String(a?.valeRefeicao ?? 0),
    adicionalNoturno: s(a?.adicionalNoturno),
    he50: a?.he50 ?? "",
    he100: a?.he100 ?? "",
    intra: s(a?.intra),
    faltasE: s(a?.faltasE),
    faltasF: s(a?.faltasF),
    faltasJust: s(a?.faltasJust),
    faltasNJust: s(a?.faltasNJust),
    dsr: s(a?.dsr),
    gratPercent: s(a?.gratPercent),
    recebeCesta: a?.recebeCesta ?? true,
    recebeAssiduidade: a?.recebeAssiduidade ?? true,
    observacoes: a?.observacoes ?? "",
  }
}

export default async function ApontamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>
}) {
  await requireSectorEdit("rh")
  const { comp } = await searchParams
  const competencia = comp || currentCompetencia()

  const [employees, apontamentos, distinct] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { not: "INATIVO" } },
      select: { id: true, name: true, matricula: true },
      orderBy: { name: "asc" },
    }),
    prisma.apontamento.findMany({ where: { competencia } }),
    prisma.apontamento.groupBy({ by: ["competencia"] }),
  ])

  const byEmp = new Map(apontamentos.map((a) => [a.employeeId, a]))

  const options = competenciaSelectOptions(
    distinct.map((d) => d.competencia),
    competencia
  )

  const rows: ApontamentoRow[] = employees.map((e) => ({
    employeeId: e.id,
    nome: e.name,
    matricula: e.matricula,
    values: toFieldValues(byEmp.get(e.id)),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apontamento"
        description="Lance os direitos de cada colaborador na competência e emita o relatório em DOCX."
      >
        <CompetenciaSelect value={competencia} options={options} />
        <Button
          variant="outline"
          nativeButton={false}
          data-tour="apont-export"
          render={<a href={`/rh/apontamento/export?comp=${competencia}`} />}
        >
          <Download className="size-4" />
          Exportar DOCX
        </Button>
      </PageHeader>

      <div data-tour="apont-grid">
        <ApontamentoGrid
          key={competencia}
          competencia={competencia}
          rows={rows}
        />
      </div>
    </div>
  )
}
