import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDateInput } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import {
  MovementForm,
  type MovementValues,
} from "@/components/rh/movement-form"

export default async function EditarMovimentacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireSectorEdit("rh")

  const [movement, employees] = await Promise.all([
    prisma.movement.findUnique({
      where: { id },
      include: { employee: { select: { name: true } } },
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  if (!movement) notFound()

  const values: MovementValues = {
    id: movement.id,
    employeeId: movement.employeeId,
    type: movement.type,
    justificada: movement.justificada,
    startDate: formatDateInput(movement.startDate),
    endDate: movement.endDate ? formatDateInput(movement.endDate) : null,
    note: movement.note,
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar movimentação"
        description={movement.employee.name}
      />
      <MovementForm employees={employees} movement={values} />
    </div>
  )
}
