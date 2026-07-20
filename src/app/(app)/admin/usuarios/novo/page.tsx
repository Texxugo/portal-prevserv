import { requireSectorEdit } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/page-header"
import { UserForm } from "@/components/admin/user-form"

export default async function NovoUsuarioPage() {
  await requireSectorEdit("admin")

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo usuário"
        description="Crie um acesso e defina o perfil."
      />
      <UserForm />
    </div>
  )
}
