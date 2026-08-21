import { requireModulo } from "@/lib/auth-helpers"
import { carregarPainel } from "@/lib/painel/dados"
import { podeEditar } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/page-header"
import { PainelOperacional } from "@/components/painel/painel-operacional"

// O painel sempre mostra um dia — o de hoje, salvo quando a URL pede outro.
// A data fica na URL (e não em estado do cliente) para que recarregar a página
// ou compartilhar o link caia no mesmo dia.
function diaDaUrl(valor: string | undefined): string {
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export default async function OperacionalPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const access = await requireModulo("PAINEL")
  const { data } = await searchParams
  const dia = diaDaUrl(data)
  const dados = await carregarPainel(access, dia)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Painel operacional"
        description="Postos e colaboradores no mapa, baixas do dia e convocação de extra."
      />
      <PainelOperacional
        dados={dados}
        podeEditar={podeEditar(access, "PAINEL")}
      />
    </div>
  )
}
