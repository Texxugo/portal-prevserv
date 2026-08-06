import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import {
  baseDepartmentIds,
  baseEmployeeOptions,
  employeeOptions,
} from "@/lib/efetivo-options"
import { PageHeader } from "@/components/layout/page-header"
import { EfetivoLoteForm } from "@/components/rh/efetivo-lote-form"

export default async function NovoEfetivoPage({
  params,
}: {
  params: Promise<{ deptId: string }>
}) {
  const { deptId } = await params
  await requireSectorEdit("rh")

  const [department, baseIds] = await Promise.all([
    prisma.department.findUnique({
      where: { id: deptId },
      select: { id: true, name: true },
    }),
    baseDepartmentIds(),
  ])
  if (!department) notFound()

  const rows = await prisma.employee.findMany({
    where: {
      status: "ATIVO",
      OR: [{ departmentId: deptId }, { departmentId: { in: baseIds } }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, matricula: true, departmentId: true },
  })
  const employees = employeeOptions(rows, deptId, baseIds)
  const baseEmployees = baseEmployeeOptions(rows, baseIds)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Novo efetivo"
        description={`Posto ${department.name.toUpperCase()} — registre o efetivo do dia por função.`}
      />
      <EfetivoLoteForm
        employees={employees}
        baseEmployees={baseEmployees}
        departmentId={department.id}
        departmentName={department.name}
      />
    </div>
  )
}
