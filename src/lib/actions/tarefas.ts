"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

import { actorName, requireUser } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { firstError } from "@/lib/form"
import { todoBoardSchema, todoColumnSchema, todoTaskSchema } from "@/lib/schemas"

type Result = { ok: boolean; error?: string; id?: string }

const SEM_ACESSO = "Sem acesso ao quadro."
const SO_DONO = "Apenas o dono do quadro pode fazer isso."

function refresh(boardId?: string) {
  revalidatePath("/tarefas")
  if (boardId) revalidatePath(`/tarefas/${boardId}`)
}

// Dono OU membro: pode ver e editar tarefas.
async function getBoardIfMember(boardId: string, userId: string) {
  return prisma.todoBoard.findFirst({
    where: {
      id: boardId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true, ownerId: true },
  })
}

// Só o dono: gerencia quadro, colunas e membros.
async function getBoardIfOwner(boardId: string, userId: string) {
  return prisma.todoBoard.findFirst({
    where: { id: boardId, ownerId: userId },
    select: { id: true, ownerId: true },
  })
}

// Reindexa 0..n-1 as tarefas de uma coluna (ordem estável pelo order atual).
function reindexOps(columnId: string, excludeTaskId?: string) {
  return prisma.todoTask
    .findMany({
      where: { columnId, ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}) },
      orderBy: { order: "asc" },
      select: { id: true },
    })
    .then((tasks) =>
      tasks.map((t, i) =>
        prisma.todoTask.update({ where: { id: t.id }, data: { order: i } })
      )
    )
}

// ---------- Quadro ----------

export async function createBoard(input: {
  name: string
  description?: string | null
}): Promise<Result> {
  const user = await requireUser()
  const parsed = todoBoardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const board = await prisma.todoBoard.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      ownerId: user.id,
      ownerName: actorName(user),
      columns: {
        create: [
          { name: "A fazer", order: 0 },
          { name: "Em andamento", order: 1 },
          { name: "Concluído", order: 2, isDone: true },
        ],
      },
    },
  })
  refresh()
  return { ok: true, id: board.id }
}

export async function updateBoard(
  boardId: string,
  input: { name: string; description?: string | null }
): Promise<Result> {
  const user = await requireUser()
  if (!(await getBoardIfOwner(boardId, user.id))) {
    return { ok: false, error: SO_DONO }
  }
  const parsed = todoBoardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  await prisma.todoBoard.update({
    where: { id: boardId },
    data: { name: parsed.data.name, description: parsed.data.description },
  })
  refresh(boardId)
  return { ok: true }
}

export async function deleteBoard(boardId: string): Promise<Result> {
  const user = await requireUser()
  if (!(await getBoardIfOwner(boardId, user.id))) {
    return { ok: false, error: SO_DONO }
  }
  // columnId da tarefa não tem cascade — apagar tarefas antes das colunas.
  await prisma.$transaction([
    prisma.todoTask.deleteMany({ where: { boardId } }),
    prisma.todoColumn.deleteMany({ where: { boardId } }),
    prisma.todoBoard.delete({ where: { id: boardId } }),
  ])
  refresh(boardId)
  return { ok: true }
}

// ---------- Membros ----------

export async function addMember(boardId: string, userId: string): Promise<Result> {
  const user = await requireUser()
  const board = await prisma.todoBoard.findFirst({
    where: { id: boardId, ownerId: user.id },
    select: { ownerId: true },
  })
  if (!board) return { ok: false, error: SO_DONO }
  if (userId === board.ownerId) {
    return { ok: false, error: "O dono já tem acesso ao quadro." }
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, active: true },
    select: { id: true, name: true, email: true },
  })
  if (!target) return { ok: false, error: "Usuário não encontrado ou inativo." }

  try {
    await prisma.todoBoardMember.create({
      data: {
        boardId,
        userId: target.id,
        userName: target.name || target.email,
        addedById: user.id,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Usuário já é membro do quadro." }
    }
    throw e
  }
  refresh(boardId)
  return { ok: true }
}

export async function removeMember(boardId: string, userId: string): Promise<Result> {
  const user = await requireUser()
  if (!(await getBoardIfOwner(boardId, user.id))) {
    return { ok: false, error: SO_DONO }
  }
  await prisma.$transaction([
    prisma.todoBoardMember.deleteMany({ where: { boardId, userId } }),
    // Tarefas atribuídas ao removido ficam sem responsável.
    prisma.todoTask.updateMany({
      where: { boardId, assigneeUserId: userId },
      data: { assigneeUserId: null, assigneeName: null },
    }),
  ])
  refresh(boardId)
  return { ok: true }
}

// ---------- Colunas ----------

export async function addColumn(boardId: string, name: string): Promise<Result> {
  const user = await requireUser()
  if (!(await getBoardIfOwner(boardId, user.id))) {
    return { ok: false, error: SO_DONO }
  }
  const parsed = todoColumnSchema.safeParse({ name })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const max = await prisma.todoColumn.aggregate({
    where: { boardId },
    _max: { order: true },
  })
  const col = await prisma.todoColumn.create({
    data: { boardId, name: parsed.data.name, order: (max._max.order ?? -1) + 1 },
  })
  refresh(boardId)
  return { ok: true, id: col.id }
}

export async function renameColumn(columnId: string, name: string): Promise<Result> {
  const user = await requireUser()
  const col = await prisma.todoColumn.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  })
  if (!col || !(await getBoardIfOwner(col.boardId, user.id))) {
    return { ok: false, error: SO_DONO }
  }
  const parsed = todoColumnSchema.safeParse({ name })
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  await prisma.todoColumn.update({
    where: { id: columnId },
    data: { name: parsed.data.name },
  })
  refresh(col.boardId)
  return { ok: true }
}

export async function deleteColumn(columnId: string): Promise<Result> {
  const user = await requireUser()
  const col = await prisma.todoColumn.findUnique({
    where: { id: columnId },
    include: { _count: { select: { tasks: true } } },
  })
  if (!col || !(await getBoardIfOwner(col.boardId, user.id))) {
    return { ok: false, error: SO_DONO }
  }

  const siblings = await prisma.todoColumn.findMany({
    where: { boardId: col.boardId, id: { not: columnId } },
    orderBy: { order: "asc" },
  })
  if (siblings.length === 0) {
    return { ok: false, error: "O quadro precisa de ao menos uma coluna." }
  }
  if (col.isDone && !siblings.some((s) => s.isDone)) {
    return {
      ok: false,
      error: "Não é possível excluir a única coluna de concluídos.",
    }
  }

  // Move as tarefas para o fim da primeira coluna restante, depois exclui.
  const dest = siblings[0]
  const destCount = await prisma.todoTask.count({ where: { columnId: dest.id } })
  const orphans = await prisma.todoTask.findMany({
    where: { columnId },
    orderBy: { order: "asc" },
    select: { id: true },
  })
  await prisma.$transaction([
    ...orphans.map((t, i) =>
      prisma.todoTask.update({
        where: { id: t.id },
        data: { columnId: dest.id, order: destCount + i },
      })
    ),
    prisma.todoColumn.delete({ where: { id: columnId } }),
  ])
  refresh(col.boardId)
  return { ok: true }
}

// ---------- Tarefas ----------

type TaskInput = {
  title: string
  description?: string | null
  assigneeUserId?: string | null
  dueDate?: string | null
  priority: string
}

// Responsável precisa ser o dono ou um membro do quadro.
async function resolveAssignee(
  boardId: string,
  assigneeUserId: string | null
): Promise<{ ok: boolean; userId: string | null; name: string | null }> {
  if (!assigneeUserId) return { ok: true, userId: null, name: null }
  const board = await prisma.todoBoard.findUnique({
    where: { id: boardId },
    select: { ownerId: true, ownerName: true, members: true },
  })
  if (!board) return { ok: false, userId: null, name: null }
  if (assigneeUserId === board.ownerId) {
    return { ok: true, userId: board.ownerId, name: board.ownerName }
  }
  const member = board.members.find((m) => m.userId === assigneeUserId)
  if (!member) return { ok: false, userId: null, name: null }
  return { ok: true, userId: member.userId, name: member.userName }
}

export async function createTask(
  boardId: string,
  input: TaskInput & { columnId?: string | null }
): Promise<Result> {
  const user = await requireUser()
  if (!(await getBoardIfMember(boardId, user.id))) {
    return { ok: false, error: SEM_ACESSO }
  }
  const parsed = todoTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const column = input.columnId
    ? await prisma.todoColumn.findFirst({ where: { id: input.columnId, boardId } })
    : await prisma.todoColumn.findFirst({
        where: { boardId },
        orderBy: { order: "asc" },
      })
  if (!column) return { ok: false, error: "Coluna não encontrada." }

  const assignee = await resolveAssignee(boardId, parsed.data.assigneeUserId)
  if (!assignee.ok) return { ok: false, error: "Responsável não é membro do quadro." }

  const count = await prisma.todoTask.count({ where: { columnId: column.id } })
  const task = await prisma.todoTask.create({
    data: {
      boardId,
      columnId: column.id,
      title: parsed.data.title,
      description: parsed.data.description,
      assigneeUserId: assignee.userId,
      assigneeName: assignee.name,
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority,
      order: count,
      createdById: user.id,
      createdByName: actorName(user),
    },
  })
  refresh(boardId)
  return { ok: true, id: task.id }
}

export async function updateTask(taskId: string, input: TaskInput): Promise<Result> {
  const user = await requireUser()
  const task = await prisma.todoTask.findUnique({
    where: { id: taskId },
    select: { boardId: true },
  })
  if (!task || !(await getBoardIfMember(task.boardId, user.id))) {
    return { ok: false, error: SEM_ACESSO }
  }
  const parsed = todoTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const assignee = await resolveAssignee(task.boardId, parsed.data.assigneeUserId)
  if (!assignee.ok) return { ok: false, error: "Responsável não é membro do quadro." }

  await prisma.todoTask.update({
    where: { id: taskId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      assigneeUserId: assignee.userId,
      assigneeName: assignee.name,
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority,
    },
  })
  refresh(task.boardId)
  return { ok: true }
}

export async function moveTask(
  taskId: string,
  input: { columnId: string; index: number }
): Promise<Result> {
  const user = await requireUser()
  const task = await prisma.todoTask.findUnique({
    where: { id: taskId },
    select: { boardId: true, columnId: true },
  })
  if (!task || !(await getBoardIfMember(task.boardId, user.id))) {
    return { ok: false, error: SEM_ACESSO }
  }
  const dest = await prisma.todoColumn.findFirst({
    where: { id: input.columnId, boardId: task.boardId },
    select: { id: true },
  })
  if (!dest) return { ok: false, error: "Coluna não encontrada." }

  // Insere no índice de destino e reindexa 0..n-1 destino (e origem, se mudou).
  const destTasks = await prisma.todoTask.findMany({
    where: { columnId: dest.id, id: { not: taskId } },
    orderBy: { order: "asc" },
    select: { id: true },
  })
  const index = Math.max(0, Math.min(input.index, destTasks.length))
  const ordered = [
    ...destTasks.slice(0, index),
    { id: taskId },
    ...destTasks.slice(index),
  ]
  const ops = ordered.map((t, i) =>
    prisma.todoTask.update({
      where: { id: t.id },
      data: t.id === taskId ? { columnId: dest.id, order: i } : { order: i },
    })
  )
  if (task.columnId !== dest.id) {
    ops.push(...(await reindexOps(task.columnId, taskId)))
  }
  await prisma.$transaction(ops)
  refresh(task.boardId)
  return { ok: true }
}

// Visão lista: concluir move p/ coluna isDone; desmarcar volta p/ 1ª coluna comum.
export async function toggleTaskDone(taskId: string, done: boolean): Promise<Result> {
  const user = await requireUser()
  const task = await prisma.todoTask.findUnique({
    where: { id: taskId },
    select: { boardId: true, columnId: true },
  })
  if (!task || !(await getBoardIfMember(task.boardId, user.id))) {
    return { ok: false, error: SEM_ACESSO }
  }
  const dest = await prisma.todoColumn.findFirst({
    where: { boardId: task.boardId, isDone: done },
    orderBy: { order: "asc" },
  })
  if (!dest) return { ok: false, error: "O quadro não tem coluna de destino." }
  if (dest.id === task.columnId) return { ok: true }

  const count = await prisma.todoTask.count({ where: { columnId: dest.id } })
  await prisma.$transaction([
    prisma.todoTask.update({
      where: { id: taskId },
      data: { columnId: dest.id, order: count },
    }),
    ...(await reindexOps(task.columnId, taskId)),
  ])
  refresh(task.boardId)
  return { ok: true }
}

export async function deleteTask(taskId: string): Promise<Result> {
  const user = await requireUser()
  const task = await prisma.todoTask.findUnique({
    where: { id: taskId },
    select: { boardId: true, columnId: true },
  })
  if (!task || !(await getBoardIfMember(task.boardId, user.id))) {
    return { ok: false, error: SEM_ACESSO }
  }
  const ops = await reindexOps(task.columnId, taskId)
  await prisma.$transaction([
    prisma.todoTask.delete({ where: { id: taskId } }),
    ...ops,
  ])
  refresh(task.boardId)
  return { ok: true }
}
