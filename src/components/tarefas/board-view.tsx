"use client"

import { useMemo, useOptimistic, useState, useTransition } from "react"
import { Columns3, List, Plus, Settings2, Users } from "lucide-react"
import { toast } from "sonner"

import { moveTask, toggleTaskDone } from "@/lib/actions/tarefas"
import { Button } from "@/components/ui/button"
import { KanbanView } from "@/components/tarefas/kanban-view"
import { ListView } from "@/components/tarefas/list-view"
import { TaskDialog } from "@/components/tarefas/task-dialog"
import { MembersDialog } from "@/components/tarefas/members-dialog"
import { BoardSettingsDialog } from "@/components/tarefas/board-settings-dialog"

export type ColumnDTO = { id: string; name: string; order: number; isDone: boolean }
export type TaskDTO = {
  id: string
  columnId: string
  title: string
  description: string | null
  assigneeUserId: string | null
  assigneeName: string | null
  dueDate: string | null // "YYYY-MM-DD"
  priority: string
  order: number
}
export type MemberDTO = { userId: string; userName: string }
export type BoardDTO = {
  id: string
  name: string
  description: string | null
  ownerId: string
  ownerName: string
  columns: ColumnDTO[]
  tasks: TaskDTO[]
  members: MemberDTO[]
}
export type UserOption = { id: string; name: string }

type MoveAction = { taskId: string; columnId: string; index: number }

// Reaplica o movimento no array plano: muda a coluna e reordena 0..n-1 as colunas afetadas.
function applyMove(tasks: TaskDTO[], action: MoveAction): TaskDTO[] {
  const moved = tasks.find((t) => t.id === action.taskId)
  if (!moved) return tasks
  const fromColumn = moved.columnId

  const dest = tasks
    .filter((t) => t.columnId === action.columnId && t.id !== action.taskId)
    .sort((a, b) => a.order - b.order)
  const index = Math.max(0, Math.min(action.index, dest.length))
  dest.splice(index, 0, { ...moved, columnId: action.columnId })

  const destOrders = new Map(dest.map((t, i) => [t.id, i]))
  const sourceOrders = new Map(
    tasks
      .filter((t) => t.columnId === fromColumn && t.id !== action.taskId)
      .sort((a, b) => a.order - b.order)
      .map((t, i) => [t.id, i])
  )

  return tasks.map((t) => {
    if (t.id === action.taskId) {
      return { ...t, columnId: action.columnId, order: destOrders.get(t.id) ?? 0 }
    }
    if (destOrders.has(t.id)) return { ...t, order: destOrders.get(t.id)! }
    if (fromColumn !== action.columnId && sourceOrders.has(t.id)) {
      return { ...t, order: sourceOrders.get(t.id)! }
    }
    return t
  })
}

export function BoardView({
  board,
  isOwner,
  users,
}: {
  board: BoardDTO
  isOwner: boolean
  users: UserOption[]
}) {
  const [view, setView] = useState<"kanban" | "lista">("kanban")
  const [, startTransition] = useTransition()
  const [optimisticTasks, applyOptimistic] = useOptimistic(board.tasks, applyMove)

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskDTO[]>()
    for (const c of board.columns) map.set(c.id, [])
    for (const t of optimisticTasks) {
      map.get(t.columnId)?.push(t)
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [board.columns, optimisticTasks])

  const doneColumnIds = useMemo(
    () => new Set(board.columns.filter((c) => c.isDone).map((c) => c.id)),
    [board.columns]
  )

  // Dono + membros: opções de responsável no dialog da tarefa.
  const assigneeOptions = useMemo(
    () => [
      { id: board.ownerId, name: board.ownerName },
      ...board.members.map((m) => ({ id: m.userId, name: m.userName })),
    ],
    [board.ownerId, board.ownerName, board.members]
  )

  const [taskDialog, setTaskDialog] = useState<{
    open: boolean
    task: TaskDTO | null
    columnId: string | null
  }>({ open: false, task: null, columnId: null })

  function handleMove(taskId: string, columnId: string, index: number) {
    startTransition(async () => {
      applyOptimistic({ taskId, columnId, index })
      const r = await moveTask(taskId, { columnId, index })
      if (!r.ok) toast.error(r.error || "Não foi possível mover a tarefa.")
    })
  }

  function handleToggle(task: TaskDTO, done: boolean) {
    const dest = board.columns
      .filter((c) => c.isDone === done)
      .sort((a, b) => a.order - b.order)[0]
    if (!dest) {
      toast.error("O quadro não tem coluna de destino.")
      return
    }
    startTransition(async () => {
      applyOptimistic({
        taskId: task.id,
        columnId: dest.id,
        index: Number.MAX_SAFE_INTEGER,
      })
      const r = await toggleTaskDone(task.id, done)
      if (!r.ok) toast.error(r.error || "Não foi possível atualizar a tarefa.")
    })
  }

  function openTask(task: TaskDTO) {
    setTaskDialog({ open: true, task, columnId: null })
  }

  function newTask(columnId?: string) {
    setTaskDialog({ open: true, task: null, columnId: columnId ?? null })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-card p-1 ring-1 ring-foreground/10">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <Columns3 className="size-4" />
            Kanban
          </Button>
          <Button
            variant={view === "lista" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("lista")}
          >
            <List className="size-4" />
            Lista
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => newTask()}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>
          {isOwner && (
            <>
              <MembersDialog
                boardId={board.id}
                ownerName={board.ownerName}
                members={board.members}
                users={users}
                trigger={
                  <Button variant="outline">
                    <Users className="size-4" />
                    Membros ({board.members.length + 1})
                  </Button>
                }
              />
              <BoardSettingsDialog
                board={board}
                trigger={
                  <Button variant="outline" aria-label="Configurações do quadro">
                    <Settings2 className="size-4" />
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanView
          columns={board.columns}
          tasksByColumn={tasksByColumn}
          onMove={handleMove}
          onOpenTask={openTask}
          onAddTask={newTask}
        />
      ) : (
        <ListView
          columns={board.columns}
          tasksByColumn={tasksByColumn}
          doneColumnIds={doneColumnIds}
          onToggle={handleToggle}
          onOpenTask={openTask}
        />
      )}

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
        boardId={board.id}
        columns={board.columns}
        assigneeOptions={assigneeOptions}
        task={taskDialog.task}
        defaultColumnId={taskDialog.columnId}
      />
    </div>
  )
}
