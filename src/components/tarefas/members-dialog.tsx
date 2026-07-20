"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Crown, Loader2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

import { addMember, removeMember } from "@/lib/actions/tarefas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MemberDTO, UserOption } from "@/components/tarefas/board-view"

export function MembersDialog({
  boardId,
  ownerName,
  members,
  users,
  trigger,
}: {
  boardId: string
  ownerName: string
  members: MemberDTO[]
  users: UserOption[]
  trigger: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("")
  const [pending, start] = useTransition()

  const available = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.userId))
    return users.filter((u) => !memberIds.has(u.id))
  }, [users, members])

  const items = Object.fromEntries(available.map((u) => [u.id, u.name]))

  function adicionar() {
    if (!selected) return
    start(async () => {
      const r = await addMember(boardId, selected)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível adicionar.")
        return
      }
      toast.success("Membro adicionado.")
      setSelected("")
      router.refresh()
    })
  }

  function remover(userId: string, userName: string) {
    start(async () => {
      const r = await removeMember(boardId, userId)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível remover.")
        return
      }
      toast.success(`${userName} removido(a) do quadro.`)
      router.refresh()
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membros do quadro</DialogTitle>
            <DialogDescription>
              Membros veem o quadro e editam tarefas. Só você gerencia o quadro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label>Adicionar usuário</Label>
                <Select
                  value={selected}
                  items={items}
                  onValueChange={(v) => setSelected(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={adicionar} disabled={pending || !selected}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Adicionar
              </Button>
            </div>

            <ul className="space-y-1">
              <li className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Crown className="size-4 text-amber-500" />
                  {ownerName}
                </span>
                <span className="text-xs text-muted-foreground">Dono</span>
              </li>
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm ring-1 ring-foreground/10"
                >
                  <span>{m.userName}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover ${m.userName}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remover(m.userId, m.userName)}
                    disabled={pending}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
              {members.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum membro ainda — só você vê este quadro.
                </li>
              )}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
