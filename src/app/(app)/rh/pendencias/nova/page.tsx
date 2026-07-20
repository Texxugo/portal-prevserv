import { ArrowLeft } from "lucide-react"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { currentCompetencia } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { formatDate } from "@/lib/format"
import { OCORRENCIA_LABEL, type OcorrenciaTipo } from "@/lib/espelho/detectar-fechamento"
import { ButtonLink } from "@/components/button-link"
import { PageHeader } from "@/components/layout/page-header"
import { DocumentoForm } from "@/components/rh/documento-form"

export default async function NovaPendenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string; occurrenceId?: string }>
}) {
  await requireSectorEdit("rh")
  const { comp, occurrenceId } = await searchParams

  const [employees, documentTypes, occurrence] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.documentoTipo.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    occurrenceId
      ? prisma.espelhoOcorrencia.findUnique({
          where: { id: occurrenceId },
          include: {
            fechamento: { include: { employee: { select: { id: true, name: true } } } },
          },
        })
      : Promise.resolve(null),
  ])

  const competencia = occurrence?.fechamento.competencia || comp || currentCompetencia()
  const origin = occurrence
    ? `${OCORRENCIA_LABEL[occurrence.tipo as OcorrenciaTipo] ?? occurrence.tipo} em ${formatDate(occurrence.data)} — ${occurrence.detalhe}`
    : null

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova pendência documental" description="Registre o documento que precisa ser acompanhado.">
        <ButtonLink variant="outline" href={`/rh/pendencias?comp=${competencia}`}>
          <ArrowLeft className="size-4" /> Voltar
        </ButtonLink>
      </PageHeader>
      <DocumentoForm
        employees={employees}
        documentTypes={documentTypes}
        defaults={{
          employeeId: occurrence?.fechamento.employee.id ?? "",
          competencia,
          occurrenceId: occurrence?.id ?? null,
          reason: occurrence?.detalhe ?? "",
          origin,
        }}
      />
    </div>
  )
}
