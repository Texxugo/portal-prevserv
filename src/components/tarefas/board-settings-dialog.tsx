"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  addColumn,
  deleteBoard,
  deleteColumn,
  renameColumn,
  updateBoard,
} from "@/lib/actions/tarefas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { BoardDTO } from "@/components/tarefas/board-view"

function ColumnRow({
  columnId,
  initialName,
  isDone,
  pending,
  onRename,
  onDelete,
}: {
  columnId: string
  initialName: string
  isDone: boolean
  pending: boolean
  onRename: (columnId: string, name: string) => void
  onDelete: (columnId: string) => void
}) {
  const [name, setName] = useState(initialName)
  const dirty = name.trim() !== initialName
  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      {isDone && (
        <span className="shrink-0 text-xs text-muted-foreground">concluídos</span>
      )}
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Salvar nome da coluna"
        onClick={() => onRename(columnId, name)}
        disabled={pending || !dirty || !name.trim()}
      >
        <Check className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Excluir coluna"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(columnId)}
        disabled={pending}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

export function BoardSettingsDialog({
  board,
  trigger,
}: {
  board: BoardDTO
  trigger: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const [name, setName] = useState(board.name)
  const [description, setDescription] = useState(board.description ?? "")
  const [newColumn, setNewColumn] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  function salvarQuadro() {
    start(async () => {
      const r = await updateBoard(board.id, { name, description: description || null })
      if (!r.ok) {
        toast.error(r.error || "Não foi possível salvar.")
        return
      }
      toast.success("Quadro atualizado.")
      router.refresh()
    })
  }

  function criarColuna() {
    start(async () => {
      const r = await addColumn(board.id, newColumn)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível criar a coluna.")
        return
      }
      setNewColumn("")
      router.refresh()
    })
  }

  function renomearColuna(columnId: string, colName: string) {
    start(async () => {
      const r = await renameColumn(columnId, colName)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível renomear.")
        return
      }
      toast.success("Coluna renomeada.")
      router.refresh()
    })
  }

  function excluirColuna(columnId: string) {
    start(async () => {
      const r = await deleteColumn(columnId)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível excluir a coluna.")
        return
      }
      toast.success("Coluna excluída — tarefas movidas para a primeira coluna.")
      router.refresh()
    })
  }

  function excluirQuadro() {
    start(async () => {
      const r = await deleteBoard(board.id)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível excluir o quadro.")
        return
      }
      toast.success("Quadro excluído.")
      router.push("/tarefas")
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do quadro</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cfg-name">Nome</Label>
                <Input
                  id="cfg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfg-desc">Descrição</Label>
                <Textarea
                  id="cfg-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={salvarQuadro}
                disabled={pending || !name.trim()}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Salvar
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Colunas</Label>
              <div className="space-y-2">
                {board.columns.map((c) => (
                  <ColumnRow
                    key={c.id}
                    columnId={c.id}
                    initialName={c.name}
                    isDone={c.isDone}
                    pending={pending}
                    onRename={renomearColuna}
                    onDelete={excluirColuna}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newColumn}
                  onChange={(e) => setNewColumn(e.target.value)}
                  placeholder="Nova coluna..."
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Adicionar coluna"
                  onClick={criarColuna}
                  disabled={pending || !newColumn.trim()}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <div className="border-t border-foreground/10 pt-4">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">
                    Excluir o quadro e todas as tarefas?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={excluirQuadro}
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
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Excluir quadro
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
