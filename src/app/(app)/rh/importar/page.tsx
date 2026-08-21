import { ArrowLeft } from "lucide-react"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { importEmployees } from "@/lib/actions/import"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { ImportPanel } from "@/components/import-panel"

export default async function ImportarColaboradoresPage() {
  await requireModuloEdit("COLABORADORES")

  return (
    <div>
      <PageHeader
        title="Importar colaboradores"
        description="Carregue o relatório de empregados da folha (Nome, Empresa, Matrícula e CPF)."
      >
        <ButtonLink variant="outline" href="/rh">
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <ImportPanel
        action={importEmployees}
        columns={[
          { key: "name", label: "Nome" },
          { key: "empresa", label: "Empresa" },
          { key: "matricula", label: "Matrícula" },
          { key: "cpf", label: "CPF" },
          { key: "sexo", label: "Sexo" },
          { key: "acao", label: "Ação" },
        ]}
        hint="O arquivo vem em blocos: uma linha com a razão social, o cabeçalho Código / Nome / Nº do C.P.F. e as linhas do pessoal daquela empresa. Quem já está cadastrado é atualizado pelo CPF — os demais campos do cadastro não são tocados. A coluna Sexo é opcional: quando existe, alimenta o ícone do painel operacional; quando não vem, o cadastro atual é preservado."
        templateName="modelo-colaboradores.csv"
        templateRows={[
          ["PREVSERV PORTARIA E LIMPEZA LTDA"],
          ["Codigo", "Nome", "Nº do C.P.F.", "Sexo"],
          ["1001", "João Silva", "12345678900", "M"],
          ["1002", "Maria Souza", "98765432100", "F"],
        ]}
        backHref="/rh"
        backLabel="Ver colaboradores"
      />
    </div>
  )
}
