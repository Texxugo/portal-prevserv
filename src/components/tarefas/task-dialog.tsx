"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from "@/lib/actions/tarefas"
import { TODO_PRIORITIES } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ColumnDTO, TaskDTO } from "@/components/tarefas/board-view"

const PRIORITY_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
}

function TaskForm({
  boardId,
  columns,
  assigneeOptions,
  task,
  defaultColumnId,
  onDone,
}: {
  boardId: string
  columns: ColumnDTO[]
  assigneeOptions: { id: string; name: string }[]
  task: TaskDTO | null
  defaultColumnId: string | null
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [assignee, setAssignee] = useState(task?.assigneeUserId ?? "")
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "")
  const [priority, setPriority] = useState(task?.priority ?? "MEDIA")
  const [columnId, setColumnId] = useState(
    task?.columnId ?? defaultColumnId ?? columns[0]?.id ?? ""
  )

  const assigneeItems = {
    "": "Sem responsável",
    ...Object.fromEntries(assigneeOptions.map((o) => [o.id, o.name])),
  }
  const columnItems = Object.fromEntries(columns.map((c) => [c.id, c.name]))
  const priorityItems = Object.fromEntries(
    TODO_PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]])
  )

  function salvar() {
    start(async () => {
      const input = {
        title,
        description: description || null,
        assigneeUserId: assignee || null,
        dueDate: dueDate || null,
        priority,
      }
      if (task) {
        const r = await updateTask(task.id, input)
        if (!r.ok) {
          toast.error(r.error || "Não foi possível salvar.")
          return
        }
        if (columnId && columnId !== task.columnId) {
          const m = await moveTask(task.id, {
            columnId,
            index: Number.MAX_SAFE_INTEGER,
          })
          if (!m.ok) {
            toast.error(m.error || "Não foi possível mover a tarefa.")
            return
          }
        }
        toast.success("Tarefa atualizada.")
      } else {
        const r = await createTask(boardId, { ...input, columnId: columnId || null })
        if (!r.ok) {
          toast.error(r.error || "Não foi possível criar a tarefa.")
          return
        }
        toast.success("Tarefa criada.")
      }
      onDone()
      router.refresh()
    })
  }

  function excluir() {
    start(async () => {
      const r = await deleteTask(task!.id)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível excluir.")
        return
      }
      toast.success("Tarefa excluída.")
      onDone()
      router.refresh()
    })
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="task-title">Título *</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que precisa ser feito?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-desc">Descrição</Label>
          <Textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select
              value={columnId}
              items={columnItems}
              onValueChange={(v) => setColumnId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={priority}
              items={priorityItems}
              onValueChange={(v) => setPriority(v ?? "MEDIA")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TODO_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={assignee}
              items={assigneeItems}
              onValueChange={(v) => setAssignee(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem responsável</SelectItem>
                {assigneeOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Prazo</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="items-center">
        {task &&
          (confirmDelete ? (
            <div className="mr-auto flex items-center gap-2">
              <span className="text-sm text-destructive">Excluir?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={excluir}
                disabled={pending}
              >
                Sim, excluir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
              >
                Não
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              <Trash2 className="size-4" />
              Excluir
            </Button>
          ))}
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={pending || !title.trim()}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {task ? "Salvar" : "Criar tarefa"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function TaskDialog({
  open,
  onOpenChange,
  boardId,
  columns,
  assigneeOptions,
  task,
  defaultColumnId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  columns: ColumnDTO[]
  assigneeOptions: { id: string; name: string }[]
  task: TaskDTO | null
  defaultColumnId: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        {/* Monta o form só com o dialog aberto: estado sempre parte do task atual */}
        {open && (
          <TaskForm
            boardId={boardId}
            columns={columns}
            assigneeOptions={assigneeOptions}
            task={task}
            defaultColumnId={defaultColumnId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
