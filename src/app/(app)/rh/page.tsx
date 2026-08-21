import { Building, Plus, Upload } from "lucide-react"

import { requireModulo } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { contarPendentesGeocode } from "@/lib/geo/geocodificar"
import { filtroDepartmentId, podeEditar } from "@/lib/permissions"
import { buildDayResolver, hasResolverSchedule } from "@/lib/jornada"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { EmployeesTable, type EmployeeRow } from "@/components/rh/employees-table"
import { LocalizarPendentes } from "@/components/rh/department-endereco"

export default async function RhPage() {
  const user = await requireModulo("COLABORADORES")
  const editable = podeEditar(user, "COLABORADORES")

  const [employees, pendentes] = await Promise.all([
    prisma.employee.findMany({
      where: filtroDepartmentId(user),
      orderBy: { name: "asc" },
      include: { department: true, escala: { select: { cycleDays: true } } },
    }),
    contarPendentesGeocode(),
  ])

  const hoje = new Date()

  const data: EmployeeRow[] = employees.map((e) => {
    const source = {
      escalaInicio: e.escalaInicio,
      escala: e.escala ? { cycleDays: e.escala.cycleDays } : null,
    }
    const onDutyToday = hasResolverSchedule(source)
      ? buildDayResolver(source)(hoje) !== null
      : null

    return {
      id: e.id,
      name: e.name,
      empresa: e.empresa,
      matricula: e.matricula,
      cpf: e.cpf,
      phone: e.phone,
      department: e.department?.name ?? null,
      status: e.status,
      onDutyToday,
      // Só é "fora do mapa" quem tem endereço e mesmo assim não virou
      // coordenada — quem nunca preencheu nada não precisa de alerta.
      semLocalizacao:
        e.lat === null && !!(e.cep || e.logradouro || e.endereco),
      optOut: e.whatsappOptOut,
    }
  })

  return (
    <div>
      <PageHeader
        title="RH / Pessoas"
        description="Colaboradores, empresas e situação."
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

      {editable && (
        <div className="mb-4">
          <LocalizarPendentes alvo="COLABORADORES" pendentes={pendentes.colaboradores} />
        </div>
      )}

      <div data-tour="rh-tabela">
        <EmployeesTable data={data} canEdit={editable} />
      </div>
    </div>
  )
}
