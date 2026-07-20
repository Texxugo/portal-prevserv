import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { canViewSalary } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/page-header"
import { EmployeeForm } from "@/components/rh/employee-form"

export default async function NovoColaboradorPage() {
  const user = await requireSectorEdit("rh")
  const [departments, escalas] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.escala.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo colaborador"
        description="Preencha os dados do colaborador."
      />
      <EmployeeForm
        departments={departments}
        escalas={escalas}
        canViewSalary={canViewSalary(user.role)}
      />
    </div>
  )
}
