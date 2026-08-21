import { notFound } from "next/navigation"

import { requirePostoEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { baseDepartmentIds, employeeOptions } from "@/lib/efetivo-options"
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
  await requirePostoEdit("EFETIVOS", deptId)

  const [efetivo, baseIds] = await Promise.all([
    prisma.efetivo.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    baseDepartmentIds(),
  ])

  if (!efetivo || efetivo.departmentId !== deptId) notFound()

  const rows = await prisma.employee.findMany({
    where: {
      OR: [
        { status: "ATIVO", departmentId: deptId },
        { status: "ATIVO", departmentId: { in: baseIds } },
        // colaborador já vinculado (legado/inativo/de outro posto) continua visível
        ...(efetivo.employeeId ? [{ id: efetivo.employeeId }] : []),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, matricula: true, departmentId: true },
  })
  const employees = employeeOptions(rows, deptId, baseIds)

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
