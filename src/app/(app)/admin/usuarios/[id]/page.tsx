import { notFound } from "next/navigation"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDateTime } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { UserForm, type UserValues } from "@/components/admin/user-form"

const ACAO_LABEL: Record<string, string> = {
  CRIACAO: "Criação",
  ALTERACAO: "Alteração",
  EXCLUSAO: "Exclusão",
}

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireModuloEdit("USUARIOS")

  const [user, postos, auditoria] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        todosPostos: true,
        modulos: { select: { modulo: true, editar: true } },
        departments: { select: { departmentId: true } },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.permissaoAuditoria.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  if (!user) notFound()

  const values: UserValues = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    todosPostos: user.todosPostos,
    modulos: user.modulos,
    departmentIds: user.departments.map((d) => d.departmentId),
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Editar usuário" description={user.email} />
      <UserForm user={values} postos={postos} />

      <section className="space-y-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-base font-medium">Histórico de permissões</h2>
          <p className="text-sm text-muted-foreground">
            Quem alterou o acesso deste usuário, quando e o que mudou.
          </p>
        </div>
        {auditoria.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma alteração registrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {auditoria.map((linha) => (
              <li
                key={linha.id}
                className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge variant="secondary">
                    {ACAO_LABEL[linha.acao] ?? linha.acao}
                  </Badge>
                  <span className="text-muted-foreground">
                    {linha.actorName}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(linha.createdAt)}
                  </span>
                </div>
                <p className="text-muted-foreground">{linha.detalhes}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
