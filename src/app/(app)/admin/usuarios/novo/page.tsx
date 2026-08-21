import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { UserForm } from "@/components/admin/user-form"

export default async function NovoUsuarioPage() {
  await requireModuloEdit("USUARIOS")

  const postos = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Novo usuário"
        description="O acesso já vem no mínimo: Efetivos e Relatório diário. O resto é liberação explícita."
      />
      <UserForm postos={postos} />
    </div>
  )
}
