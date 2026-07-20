"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Crown, Loader2, Plus, Users } from "lucide-react"
import { toast } from "sonner"

import { createBoard } from "@/lib/actions/tarefas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type BoardCard = {
  id: string
  name: string
  description: string | null
  ownerName: string
  isOwner: boolean
  members: number
  tasks: number
  done: number
}

export function BoardsGrid({ boards }: { boards: BoardCard[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pending, start] = useTransition()

  function abrir() {
    setName("")
    setDescription("")
    setOpen(true)
  }

  function criar() {
    start(async () => {
      const r = await createBoard({ name, description: description || null })
      if (!r.ok || !r.id) {
        toast.error(r.error || "Não foi possível criar o quadro.")
        return
      }
      toast.success("Quadro criado.")
      setOpen(false)
      router.push(`/tarefas/${r.id}`)
    })
  }

  return (
    <div className="space-y-4">
      <Button onClick={abrir}>
        <Plus className="size-4" />
        Novo quadro
      </Button>

      {boards.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Nenhum quadro ainda. Crie o primeiro e compartilhe com o seu time.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/tarefas/${b.id}`}
              className="group space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:ring-foreground/25"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium group-hover:underline">{b.name}</p>
                {b.isOwner ? (
                  <Badge variant="secondary" className="shrink-0">
                    <Crown className="size-3" /> Dono
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Membro
                  </Badge>
                )}
              </div>
              {b.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {b.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {b.done}/{b.tasks} concluída(s)
                </span>
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {b.members + 1}
                </span>
              </div>
              {!b.isOwner && (
                <p className="text-xs text-muted-foreground">Dono: {b.ownerName}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo quadro</DialogTitle>
            <DialogDescription>
              Crie a lista e depois adicione os membros que podem vê-la e editá-la.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="board-name">Nome *</Label>
              <Input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Rotinas do RH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-desc">Descrição</Label>
              <Textarea
                id="board-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={pending || !name.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Criar quadro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
