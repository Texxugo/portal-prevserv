import { requireUser } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"
import { BoardsGrid, type BoardCard } from "@/components/tarefas/boards-grid"

export default async function TarefasPage() {
  const user = await requireUser()

  const boards = await prisma.todoBoard.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    include: {
      _count: { select: { tasks: true, members: true } },
      columns: { where: { isDone: true }, select: { id: true } },
      tasks: { select: { columnId: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const cards: BoardCard[] = boards.map((b) => {
    const doneCols = new Set(b.columns.map((c) => c.id))
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      ownerName: b.ownerName,
      isOwner: b.ownerId === user.id,
      members: b._count.members,
      tasks: b._count.tasks,
      done: b.tasks.filter((t) => doneCols.has(t.columnId)).length,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        description="Listas de tarefas e quadros Kanban compartilhados com quem você escolher."
      />
      <BoardsGrid boards={cards} />
    </div>
  )
}
