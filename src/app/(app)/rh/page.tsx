import { Building, Plus, Upload } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { canEdit, canViewSalary } from "@/lib/permissions"
import { buildDayResolver, hasResolverSchedule } from "@/lib/jornada"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { EmployeesTable, type EmployeeRow } from "@/components/rh/employees-table"

export default async function RhPage() {
  const user = await requireSector("rh")
  const editable = canEdit(user.role, "rh")
  const showSalary = canViewSalary(user.role)

  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: { department: true, escala: { select: { cycleDays: true } } },
  })

  const hoje = new Date()

  const data: EmployeeRow[] = employees.map((e) => {
    const source = {
      workSchedule: e.workSchedule,
      escalaInicio: e.escalaInicio,
      escala: e.escala ? { cycleDays: e.escala.cycleDays } : null,
    }
    const onDutyToday = hasResolverSchedule(source)
      ? buildDayResolver(source)(hoje) !== null
      : null

    return {
      id: e.id,
      name: e.name,
      cpf: e.cpf,
      email: e.email,
      phone: e.phone,
      position: e.position,
      department: e.department?.name ?? null,
      status: e.status,
      salary: showSalary ? e.salary : null,
      onDutyToday,
    }
  })

  return (
    <div>
      <PageHeader
        title="RH / Pessoas"
        description="Colaboradores, cargos e situação."
      >
        {editable && (
          <>
            <ButtonLink
              variant="outline"
              href="/rh/departamentos"
              data-tour="rh-departamentos"
            >
              <Building className="size-4" />
              Departamentos
            </ButtonLink>
            <ButtonLink
              variant="outline"
              href="/rh/importar"
              data-tour="rh-importar"
            >
              <Upload className="size-4" />
              Importar
            </ButtonLink>
            <ButtonLink href="/rh/novo" data-tour="rh-novo">
              <Plus className="size-4" />
              Novo colaborador
            </ButtonLink>
          </>
        )}
      </PageHeader>

      <div data-tour="rh-tabela">
        <EmployeesTable
          data={data}
          canEdit={editable}
          canViewSalary={showSalary}
        />
      </div>
    </div>
  )
}
