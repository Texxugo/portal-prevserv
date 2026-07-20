"use client"

import { useState } from "react"
import { CalendarDays, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ColumnDTO, TaskDTO } from "@/components/tarefas/board-view"

export const PRIORITY_META: Record<string, { label: string; className: string }> = {
  ALTA: { label: "Alta", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  MEDIA: {
    label: "Média",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  BAIXA: { label: "Baixa", className: "bg-foreground/10 text-muted-foreground" },
}

function isOverdue(task: TaskDTO, column: ColumnDTO): boolean {
  if (!task.dueDate || column.isDone) return false
  return task.dueDate < new Date().toISOString().slice(0, 10)
}

export function KanbanView({
  columns,
  tasksByColumn,
  onMove,
  onOpenTask,
  onAddTask,
}: {
  columns: ColumnDTO[]
  tasksByColumn: Map<string, TaskDTO[]>
  onMove: (taskId: string, columnId: string, index: number) => void
  onOpenTask: (task: TaskDTO) => void
  onAddTask: (columnId: string) => void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  function dropIndex(columnId: string, targetTaskId?: string): number {
    const list = (tasksByColumn.get(columnId) ?? []).filter(
      (t) => t.id !== draggingId
    )
    if (!targetTaskId) return list.length
    const i = list.findIndex((t) => t.id === targetTaskId)
    return i === -1 ? list.length : i
  }

  function handleDrop(columnId: string, targetTaskId?: string) {
    if (draggingId) onMove(draggingId, columnId, dropIndex(columnId, targetTaskId))
    setDraggingId(null)
    setOverColumn(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const tasks = tasksByColumn.get(col.id) ?? []
        return (
          <div
            key={col.id}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10 transition",
              overColumn === col.id && draggingId && "ring-2 ring-primary"
            )}
            onDragOver={(e) => {
              e.preventDefault() // obrigatório: sem isso o onDrop não dispara
              setOverColumn(col.id)
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(col.id)
            }}
          >
            <div className="flex items-center justify-between gap-2 p-3 pb-1">
              <p className="text-sm font-medium">
                {col.name}{" "}
                <span className="text-muted-foreground">({tasks.length})</span>
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Nova tarefa em ${col.name}`}
                onClick={() => onAddTask(col.id)}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="flex min-h-24 flex-col gap-2 p-3 pt-2">
              {tasks.map((task) => {
                const pr = PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIA
                const overdue = isOverdue(task, col)
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id) // Firefox exige
                      e.dataTransfer.effectAllowed = "move"
                      setDraggingId(task.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverColumn(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation() // não deixa o drop da coluna disparar também
                      handleDrop(col.id, task.id)
                    }}
                    onClick={() => onOpenTask(task)}
                    className={cn(
                      "cursor-grab space-y-2 rounded-lg bg-background p-3 ring-1 ring-foreground/10 transition hover:ring-foreground/25",
                      draggingId === task.id && "opacity-50"
                    )}
                  >
                    {/* Durante o drag, filhos não capturam eventos (evita flicker de dragenter) */}
                    <div className={cn(draggingId && "pointer-events-none")}>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          col.isDone && "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={cn("text-xs", pr.className)}>
                          {pr.label}
                        </Badge>
                        {task.dueDate && (
                          <span
                            className={cn(
                              "flex items-center gap-1 text-xs text-muted-foreground",
                              overdue && "font-medium text-rose-600 dark:text-rose-400"
                            )}
                          >
                            <CalendarDays className="size-3" />
                            {formatDate(new Date(task.dueDate + "T00:00:00"))}
                          </span>
                        )}
                        {task.assigneeName && (
                          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary" title={task.assigneeName}>
                            {task.assigneeName
                              .split(" ")
                              .slice(0, 2)
                              .map((p) => p[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {tasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-foreground/15 p-3 text-center text-xs text-muted-foreground">
                  Solte tarefas aqui
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
