import { requireSector } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { RelatorioVerificarForm } from "@/components/rh/relatorio-verificar-form"

export default async function VerificarRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>
}) {
  await requireSector("rh")
  const { codigo } = await searchParams

  return (
    <div>
      <PageHeader
        title="Verificar relatório"
        description="Confira se um relatório recebido foi mesmo emitido pelo sistema e veja o efetivo cadastrado para aquele turno."
      >
        <ButtonLink variant="outline" href="/rh/efetivos">
          Efetivos
        </ButtonLink>
      </PageHeader>
      <RelatorioVerificarForm inicial={codigo} />
    </div>
  )
}
