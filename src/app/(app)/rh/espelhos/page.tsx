import { ArrowLeft } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { competenciaLabel, currentCompetencia, lastCompetencias } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { EspelhoPanel } from "@/components/rh/espelho-panel"

export default async function EspelhosPage() {
  await requireSector("rh")
  const options = lastCompetencias(12).map((v) => ({
    value: v,
    label: competenciaLabel(v),
  }))
  const documentTypes = await prisma.documentoTipo.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return (
    <div>
      <PageHeader
        title="Espelhos de ponto"
        description="Importe o TXT do Qyon, revise as ocorrências e avise o colaborador pelo WhatsApp."
      >
        <ButtonLink variant="outline" href="/rh">
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <div data-tour="espelho-panel">
        <EspelhoPanel
          competenciaOptions={options}
          defaultCompetencia={currentCompetencia()}
          documentTypes={documentTypes}
        />
      </div>
    </div>
  )
}
