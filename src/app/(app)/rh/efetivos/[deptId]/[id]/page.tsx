import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDateInput } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import {
  EfetivoForm,
  type EfetivoValues,
} from "@/components/rh/efetivo-form"

export default async function EditarEfetivoPage({
  params,
}: {
  params: Promise<{ deptId: string; id: string }>
}) {
  const { deptId, id } = await params
  await requireSectorEdit("rh")

  const [efetivo, employees] = await Promise.all([
    prisma.efetivo.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  if (!efetivo || efetivo.departmentId !== deptId) notFound()

  const values: EfetivoValues = {
    id: efetivo.id,
    employeeId: efetivo.employeeId,
    freelancerName: efetivo.freelancerName,
    departmentId: efetivo.departmentId,
    date: formatDateInput(efetivo.date),
    horario: efetivo.horario,
    local: efetivo.local,
    evento: efetivo.evento,
    periodo: efetivo.periodo,
    extra: efetivo.extra,
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar efetivo"
        description={efetivo.employee?.name ?? efetivo.freelancerName ?? ""}
      />
      <EfetivoForm
        employees={employees}
        departmentId={efetivo.department.id}
        departmentName={efetivo.department.name}
        efetivo={values}
      />
    </div>
  )
}
