import { Plus } from "lucide-react"

import { requireModulo } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { UsersTable, type UserRow } from "@/components/admin/users-table"

export default async function UsuariosPage() {
  const me = await requireModulo("USUARIOS")
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      todosPostos: true,
      _count: { select: { modulos: true, departments: true } },
    },
  })

  const data: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    // ADMIN não depende das linhas gravadas: o perfil já alcança tudo
    modulos: u.role === "ADMIN" ? null : u._count.modulos,
    postos: u.role === "ADMIN" || u.todosPostos ? null : u._count.departments,
  }))

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Quem entra, o que enxerga e em quais postos."
      >
        <ButtonLink href="/admin/usuarios/novo">
          <Plus className="size-4" />
          Novo usuário
        </ButtonLink>
      </PageHeader>

      <UsersTable data={data} currentUserId={me.id} />
    </div>
  )
}
