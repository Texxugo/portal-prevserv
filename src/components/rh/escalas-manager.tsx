"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { createEscala, deleteEscala, updateEscala } from "@/lib/actions/escalas"
import { parseCycle, type CycleSchedule } from "@/lib/jornada"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDelete } from "@/components/confirm-delete"
import { CycleEditor } from "@/components/rh/cycle-editor"

type EscalaRow = {
  id: string
  name: string
  cycleDays: string
  cycleLength: number
}

export function EscalasManager({ escalas }: { escalas: EscalaRow[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [cycle, setCycle] = useState<CycleSchedule>([null, null])
  const [pending, start] = useTransition()

  function reset() {
    setEditingId(null)
    setName("")
    setCycle([null, null])
  }

  function edit(e: EscalaRow) {
    setEditingId(e.id)
    setName(e.name)
    setCycle(parseCycle(e.cycleDays) ?? [null])
  }

  function save() {
    start(async () => {
      const json = JSON.stringify(cycle)
      const r = editingId
        ? await updateEscala(editingId, name, json)
        : await createEscala(name, json)
      if (r.ok) {
        toast.success(editingId ? "Escala atualizada." : "Escala criada.")
        reset()
        router.refresh()
      } else {
        toast.error(r.error || "Erro ao salvar.")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <h2 className="text-lg font-medium">
          {editingId ? "Editar escala" : "Nova escala"}
        </h2>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="escala-name">Nome</Label>
          <Input
            id="escala-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: 12x36 diurno"
          />
        </div>
        <CycleEditor value={cycle} onChange={setCycle} />
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending || !name.trim()}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editingId ? null : (
              <Plus className="size-4" />
            )}
            {editingId ? "Salvar" : "Criar"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={reset} disabled={pending}>
              <X className="size-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {escalas.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma escala cadastrada.
          </p>
        ) : (
          escalas.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <span className="font-medium">{e.name}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  · ciclo de {e.cycleLength} dia(s)
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar"
                  onClick={() => edit(e)}
                >
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDelete
                  onConfirm={async () => {
                    await deleteEscala(e.id)
                  }}
                  title="Excluir escala"
                  description={`Excluir "${e.name}"? Colaboradores vinculados ficarão sem escala.`}
                  successMessage="Escala excluída."
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
