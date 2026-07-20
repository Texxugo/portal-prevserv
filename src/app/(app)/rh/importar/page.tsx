import { ArrowLeft } from "lucide-react"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { importEmployees } from "@/lib/actions/import"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { ImportPanel } from "@/components/import-panel"

export default async function ImportarColaboradoresPage() {
  await requireSectorEdit("rh")

  return (
    <div>
      <PageHeader
        title="Importar colaboradores"
        description="Carregue uma planilha (.xlsx ou .csv) com os colaboradores."
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
          { key: "matricula", label: "Matrícula" },
          { key: "cpf", label: "CPF" },
          { key: "email", label: "E-mail" },
          { key: "phone", label: "Telefone" },
          { key: "position", label: "Cargo" },
          { key: "department", label: "Departamento" },
          { key: "admissionDate", label: "Admissão" },
          { key: "salary", label: "Salário" },
          { key: "status", label: "Situação" },
        ]}
        templateName="modelo-colaboradores.csv"
        templateHeaders={[
          "Nome",
          "Matricula",
          "CPF",
          "Email",
          "Telefone",
          "Cargo",
          "Departamento",
          "Admissao",
          "Salario",
          "Situacao",
        ]}
        templateExample={[
          "João Silva",
          "1001",
          "123.456.789-00",
          "joao@empresa.com",
          "1010",
          "Analista",
          "Tecnologia",
          "2024-01-15",
          "5000",
          "ATIVO",
        ]}
        backHref="/rh"
        backLabel="Ver colaboradores"
      />
    </div>
  )
}
