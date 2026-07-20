import { notFound } from "next/navigation"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDate, formatDateInput } from "@/lib/format"
import { canEdit } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DateFilter } from "@/components/date-filter"
import {
  EfetivosTable,
  type EfetivoRow,
} from "@/components/rh/efetivos-table"

export default async function EfetivosDepartamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ deptId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const user = await requireSector("rh")
  const editable = canEdit(user.role, "rh")

  const { deptId } = await params
  const { date } = await searchParams
  const dateStr = date || formatDateInput(new Date())

  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: { id: true, name: true },
  })
  if (!department) notFound()

  const efetivos = await prisma.efetivo.findMany({
    where: { departmentId: department.id, date: new Date(dateStr) },
    include: {
      employee: { select: { name: true } },
      documentPendencias: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
    orderBy: [{ periodo: "asc" }, { createdAt: "asc" }],
  })

  const rows: EfetivoRow[] = efetivos.map((e) => ({
    id: e.id,
    departmentId: department.id,
    pessoa: e.employee?.name ?? e.freelancerName ?? "—",
    freelancer: !e.employeeId,
    horario: e.horario,
    local: e.local,
    evento: e.evento,
    periodo: e.periodo,
    extra: e.extra,
    documentoStatus: e.documentPendencias[0]?.status ?? null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={department.name.toUpperCase()}
        description={`Efetivos do posto em ${formatDate(new Date(dateStr))}.`}
      >
        <ButtonLink variant="outline" href="/rh/efetivos">
          Todos os postos
        </ButtonLink>
        <DateFilter value={dateStr} />
        {editable && (
          <ButtonLink
            href={`/rh/efetivos/${department.id}/novo`}
            data-tour="efet-novo"
          >
            Novo efetivo
          </ButtonLink>
        )}
      </PageHeader>
      <div data-tour="efet-tabela">
        <EfetivosTable data={rows} canEdit={editable} />
      </div>
    </div>
  )
}
