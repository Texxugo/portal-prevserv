import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { MovementForm } from "@/components/rh/movement-form"

export default async function NovaMovimentacaoPage() {
  await requireSectorEdit("rh")
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova movimentação"
        description="Registre uma falta, férias, contratação ou demissão."
      />
      <MovementForm employees={employees} />
    </div>
  )
}
