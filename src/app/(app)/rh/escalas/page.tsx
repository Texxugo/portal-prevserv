import { ArrowLeft } from "lucide-react"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { parseCycle } from "@/lib/jornada"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { EscalasManager } from "@/components/rh/escalas-manager"

export default async function EscalasPage() {
  await requireSectorEdit("rh")
  const escalas = await prisma.escala.findMany({ orderBy: { name: "asc" } })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Escalas"
        description="Cadastre escalas rotativas (ciclo de dias) para atribuir aos colaboradores."
      >
        <ButtonLink variant="outline" href="/rh">
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <div data-tour="escalas-manager">
        <EscalasManager
          escalas={escalas.map((e) => ({
            id: e.id,
            name: e.name,
            cycleDays: e.cycleDays,
            cycleLength: parseCycle(e.cycleDays)?.length ?? 0,
          }))}
        />
      </div>
    </div>
  )
}
