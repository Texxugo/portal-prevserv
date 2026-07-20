import { Plus } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { UsersTable, type UserRow } from "@/components/admin/users-table"

export default async function UsuariosPage() {
  const me = await requireSector("admin")
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os acessos e perfis da plataforma."
      >
        <ButtonLink href="/admin/usuarios/novo">
          <Plus className="size-4" />
          Novo usuário
        </ButtonLink>
      </PageHeader>

      <UsersTable data={users as UserRow[]} currentUserId={me.id} />
    </div>
  )
}
