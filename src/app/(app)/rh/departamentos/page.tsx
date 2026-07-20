import { ArrowLeft } from "lucide-react"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DepartmentsManager } from "@/components/rh/departments-manager"

export default async function DepartamentosPage() {
  await requireSectorEdit("rh")
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Departamentos"
        description="Gerencie os departamentos da empresa."
      >
        <ButtonLink variant="outline" href="/rh">
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <DepartmentsManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          count: d._count.employees,
        }))}
      />
    </div>
  )
}
