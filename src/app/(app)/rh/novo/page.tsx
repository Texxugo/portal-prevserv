import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { filtroPostoId, podeVerSalario } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/page-header"
import { EmployeeForm } from "@/components/rh/employee-form"

export default async function NovoColaboradorPage() {
  const user = await requireModuloEdit("COLABORADORES")
  const [departments, escalas] = await Promise.all([
    prisma.department.findMany({
      where: filtroPostoId(user),
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
        canViewSalary={podeVerSalario(user)}
      />
    </div>
  )
}
