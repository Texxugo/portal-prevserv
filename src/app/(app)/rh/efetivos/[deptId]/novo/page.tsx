import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { EfetivoForm } from "@/components/rh/efetivo-form"

export default async function NovoEfetivoPage({
  params,
}: {
  params: Promise<{ deptId: string }>
}) {
  const { deptId } = await params
  await requireSectorEdit("rh")

  const [department, employees] = await Promise.all([
    prisma.department.findUnique({
      where: { id: deptId },
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  if (!department) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo efetivo"
        description={`Posto ${department.name.toUpperCase()} — registre o profissional, evento e documentação.`}
      />
      <EfetivoForm
        employees={employees}
        departmentId={department.id}
        departmentName={department.name}
      />
    </div>
  )
}
