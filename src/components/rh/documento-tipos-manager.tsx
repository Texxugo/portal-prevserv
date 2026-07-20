"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"

import {
  createDocumentoTipo,
  setDocumentoTipoActive,
  updateDocumentoTipo,
} from "@/lib/actions/documentos"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TypeRow = { id: string; name: string; active: boolean; usageCount: number }

export function DocumentoTiposManager({ types }: { types: TypeRow[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [pending, start] = useTransition()

  function reset() {
    setEditingId(null)
    setName("")
  }

  function save() {
    start(async () => {
      const result = editingId
        ? await updateDocumentoTipo(editingId, name)
        : await createDocumentoTipo(name)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível salvar.")
        return
      }
      toast.success(editingId ? "Tipo atualizado." : "Tipo criado.")
      reset()
      router.refresh()
    })
  }

  function toggle(id: string, active: boolean) {
    start(async () => {
      await setDocumentoTipoActive(id, active)
      toast.success(active ? "Tipo reativado." : "Tipo desativado.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <h2 className="text-lg font-medium">{editingId ? "Editar tipo" : "Novo tipo"}</h2>
        <div className="max-w-md space-y-2">
          <Label htmlFor="document-type-name">Nome</Label>
          <Input id="document-type-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Atestado médico" />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending || name.trim().length < 2}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : !editingId ? <Plus className="size-4" /> : null}
            {editingId ? "Salvar" : "Criar"}
          </Button>
          {editingId && <Button variant="ghost" onClick={reset}><X className="size-4" />Cancelar</Button>}
        </div>
      </div>

      <div className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {types.map((type) => (
          <div key={type.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{type.name}</span>
              <Badge variant="secondary">{type.active ? "Ativo" : "Inativo"}</Badge>
              <span className="text-xs text-muted-foreground">{type.usageCount} uso(s)</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => { setEditingId(type.id); setName(type.name) }}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggle(type.id, !type.active)} disabled={pending}>
                {type.active ? <X className="size-4" /> : <RotateCcw className="size-4" />}
                {type.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
