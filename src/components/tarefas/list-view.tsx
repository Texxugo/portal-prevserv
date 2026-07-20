"use client"

import { CalendarDays, CheckCircle2, Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ColumnDTO, TaskDTO } from "@/components/tarefas/board-view"
import { PRIORITY_META } from "@/components/tarefas/kanban-view"

export function ListView({
  columns,
  tasksByColumn,
  doneColumnIds,
  onToggle,
  onOpenTask,
}: {
  columns: ColumnDTO[]
  tasksByColumn: Map<string, TaskDTO[]>
  doneColumnIds: Set<string>
  onToggle: (task: TaskDTO, done: boolean) => void
  onOpenTask: (task: TaskDTO) => void
}) {
  const total = columns.reduce(
    (acc, c) => acc + (tasksByColumn.get(c.id)?.length ?? 0),
    0
  )
  if (total === 0) {
    return (
      <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        Nenhuma tarefa ainda. Crie a primeira em “Nova tarefa”.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Tarefa</TableHead>
            <TableHead className="w-36">Etapa</TableHead>
            <TableHead className="w-24">Prioridade</TableHead>
            <TableHead className="w-40">Responsável</TableHead>
            <TableHead className="w-32">Prazo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.flatMap((col) => {
            const done = doneColumnIds.has(col.id)
            return (tasksByColumn.get(col.id) ?? []).map((task) => {
              const pr = PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIA
              const overdue =
                !done &&
                !!task.dueDate &&
                task.dueDate < new Date().toISOString().slice(0, 10)
              return (
                <TableRow
                  key={task.id}
                  className="cursor-pointer"
                  onClick={() => onOpenTask(task)}
                >
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(task, !done)
                      }}
                    >
                      {done ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-medium",
                        done && "text-muted-foreground line-through"
                      )}
                    >
                      {task.title}
                    </span>
                    {task.description && (
                      <span className="block max-w-md truncate text-xs text-muted-foreground">
                        {task.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{col.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(pr.className)}>
                      {pr.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.assigneeName || "—"}
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 text-sm text-muted-foreground",
                          overdue && "font-medium text-rose-600 dark:text-rose-400"
                        )}
                      >
                        <CalendarDays className="size-3.5" />
                        {formatDate(new Date(task.dueDate + "T00:00:00"))}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          })}
        </TableBody>
      </Table>
    </div>
  )
}
