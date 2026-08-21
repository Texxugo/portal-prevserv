import { ArrowLeft } from "lucide-react"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { contarPendentesGeocode } from "@/lib/geo/geocodificar"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DepartmentsManager } from "@/components/rh/departments-manager"

export default async function DepartamentosPage() {
  await requireModuloEdit("DEPARTAMENTOS")
  const [departments, pendentes] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    }),
    contarPendentesGeocode(),
  ])

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
        postosSemCoordenada={pendentes.postos}
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          count: d._count.employees,
          whatsappGrupoId: d.whatsappGrupoId,
          cep: d.cep,
          logradouro: d.logradouro,
          numero: d.numero,
          complemento: d.complemento,
          bairro: d.bairro,
          cidade: d.cidade,
          uf: d.uf,
          lat: d.lat,
          geocodeStatus: d.geocodeStatus,
        }))}
      />
    </div>
  )
}
