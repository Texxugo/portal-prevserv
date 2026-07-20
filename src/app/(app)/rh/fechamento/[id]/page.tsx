import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { competenciaLabel } from "@/lib/competencia"
import { formatDate } from "@/lib/format"
import { canEdit } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import {
  FechamentoDetail,
  type OcorrenciaView,
} from "@/components/rh/fechamento-detail"

export default async function FechamentoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ comp?: string }>
}) {
  const { id } = await params
  const { comp } = await searchParams
  const user = await requireSector("rh")

  const f = await prisma.espelhoFechamento.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true } },
      ocorrencias: { orderBy: { data: "asc" } },
      eventos: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  })
  if (!f) notFound()

  const compInfo = await prisma.espelhoCompetencia.findUnique({
    where: { competencia: f.competencia },
  })
  const locked = compInfo?.status === "FECHADA"

  const canManageDocuments = canEdit(user.role, "rh")
  const documentPendencias = canManageDocuments
    ? await prisma.documentoPendencia.findMany({
        where: {
          employeeId: f.employeeId,
          competencia: f.competencia,
          status: { in: ["PENDENTE", "SOLICITADO"] },
        },
        include: { documentType: { select: { name: true } } },
      })
    : []

  const ocorrencias: OcorrenciaView[] = f.ocorrencias.map((o) => ({
    id: o.id,
    data: formatDate(o.data),
    tipo: o.tipo,
    detalhe: o.detalhe,
    marcacoes: o.marcacoes,
    categoria: o.justificativaCategoria,
    obs: o.justificativaObs,
    resolvido: o.resolvido,
    documentPendencias: documentPendencias
      .filter(
        (pending) =>
          pending.occurrenceId === o.id ||
          (pending.sourceDate?.getTime() === o.data.getTime() &&
            pending.sourceType === o.tipo)
      )
      .map((pending) => ({
        id: pending.id,
        typeName: pending.documentType.name,
        status: pending.status,
      })),
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={f.employee.name}
        description={`Espelho · ${competenciaLabel(f.competencia)}`}
      >
        <ButtonLink
          variant="outline"
          href={`/rh/fechamento?comp=${comp || f.competencia}`}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <FechamentoDetail
        fechamentoId={f.id}
        status={f.status}
        locked={locked}
        ocorrencias={ocorrencias}
        openDocumentCount={documentPendencias.length}
        canManageDocuments={canManageDocuments}
        eventos={f.eventos.map((e) => ({
          id: e.id,
          action: e.action,
          description: e.description,
          actorName: e.actorName,
          quando: `${formatDate(e.createdAt)} ${e.createdAt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        }))}
      />
    </div>
  )
}
