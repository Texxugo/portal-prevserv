import { ArrowLeft } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { requireUser } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import {
  BoardView,
  type BoardDTO,
  type UserOption,
} from "@/components/tarefas/board-view"

export default async function TarefaBoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const board = await prisma.todoBoard.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { order: "asc" } },
      tasks: { orderBy: { order: "asc" } },
      members: { orderBy: { userName: "asc" } },
    },
  })
  if (!board) notFound()

  const isOwner = board.ownerId === user.id
  const isMember = board.members.some((m) => m.userId === user.id)
  if (!isOwner && !isMember) redirect("/tarefas")

  // Picker de membros: só o dono precisa da lista de usuários ativos.
  const users: UserOption[] = isOwner
    ? (
        await prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      ).map((u) => ({ id: u.id, name: u.name || u.email }))
    : []

  // DTO plano: Dates viram ISO string para o client component.
  const dto: BoardDTO = {
    id: board.id,
    name: board.name,
    description: board.description,
    ownerId: board.ownerId,
    ownerName: board.ownerName,
    columns: board.columns.map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
      isDone: c.isDone,
    })),
    tasks: board.tasks.map((t) => ({
      id: t.id,
      columnId: t.columnId,
      title: t.title,
      description: t.description,
      assigneeUserId: t.assigneeUserId,
      assigneeName: t.assigneeName,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      priority: t.priority,
      order: t.order,
    })),
    members: board.members.map((m) => ({ userId: m.userId, userName: m.userName })),
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={board.name}
        description={board.description || "Quadro de tarefas compartilhado."}
      >
        <ButtonLink variant="outline" href="/tarefas">
          <ArrowLeft className="size-4" />
          Voltar
        </ButtonLink>
      </PageHeader>

      <BoardView board={dto} isOwner={isOwner} users={users} />
    </div>
  )
}
