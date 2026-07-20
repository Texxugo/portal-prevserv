import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { UserForm, type UserValues } from "@/components/admin/user-form"

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireSectorEdit("admin")

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  if (!user) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar usuário" description={user.email} />
      <UserForm user={user as UserValues} />
    </div>
  )
}
