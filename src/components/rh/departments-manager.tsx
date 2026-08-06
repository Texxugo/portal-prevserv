"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import {
  createDepartment,
  deleteDepartment,
  listarGruposWhatsapp,
  setDepartmentGrupo,
} from "@/lib/actions/rh"
import type { FormState } from "@/lib/form"
import type { GrupoWhatsapp } from "@/lib/zapi"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"

type Dept = {
  id: string
  name: string
  count: number
  whatsappGrupoId: string | null
}

// Destino do relatório diário do posto. Dá para colar o ID à mão, mas o
// caminho normal é "Escolher": lista os grupos da conta conectada e o usuário
// clica no do posto, sem precisar descobrir o ID em lugar nenhum.
function GrupoField({
  dept,
  grupos,
  onEscolher,
}: {
  dept: Dept
  grupos: GrupoWhatsapp[] | null
  onEscolher: (dept: Dept) => void
}) {
  const [valor, setValor] = useState(dept.whatsappGrupoId ?? "")
  const [salvo, setSalvo] = useState(dept.whatsappGrupoId ?? "")
  const [pending, startTransition] = useTransition()

  // o valor vindo do servidor muda quando a escolha é feita pelo diálogo
  const [propAnterior, setPropAnterior] = useState(dept.whatsappGrupoId ?? "")
  if ((dept.whatsappGrupoId ?? "") !== propAnterior) {
    setPropAnterior(dept.whatsappGrupoId ?? "")
    setValor(dept.whatsappGrupoId ?? "")
    setSalvo(dept.whatsappGrupoId ?? "")
  }

  function salvar() {
    if (valor.trim() === salvo) return
    startTransition(async () => {
      const result = await setDepartmentGrupo(dept.id, valor)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível salvar o grupo.")
        setValor(salvo)
        return
      }
      setSalvo(valor.trim())
      toast.success(
        valor.trim()
          ? `Relatórios de ${dept.name} passam a ser enviados ao grupo.`
          : `Envio automático desligado em ${dept.name}.`
      )
    })
  }

  const nomeDoGrupo = grupos?.find((g) => g.id === salvo)?.nome

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          placeholder="Grupo de WhatsApp (opcional)"
          aria-label={`Grupo de WhatsApp de ${dept.name}`}
          disabled={pending}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => onEscolher(dept)}
        >
          <Search className="size-4" />
          Escolher
        </Button>
        {pending && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>
      {nomeDoGrupo && (
        <p className="text-xs text-muted-foreground">
          Grupo: <span className="font-medium">{nomeDoGrupo}</span>
        </p>
      )}
    </div>
  )
}

function AddButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Plus className="size-4" />
      )}
      Adicionar
    </Button>
  )
}

export function DepartmentsManager({ departments }: { departments: Dept[] }) {
  const router = useRouter()
  const [state, action] = useActionState<FormState, FormData>(
    createDepartment,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  // lista da Z-API, carregada sob demanda e compartilhada por todas as linhas
  const [grupos, setGrupos] = useState<GrupoWhatsapp[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [alvo, setAlvo] = useState<Dept | null>(null)
  const [salvandoEscolha, startEscolha] = useTransition()

  useEffect(() => {
    if (state?.message === "ok") {
      formRef.current?.reset()
      toast.success("Departamento adicionado.")
    }
  }, [state])

  async function carregarGrupos(): Promise<GrupoWhatsapp[] | null> {
    if (grupos) return grupos
    setCarregando(true)
    try {
      const result = await listarGruposWhatsapp()
      if (!result.ok || !result.grupos) {
        toast.error(result.error || "Não foi possível listar os grupos.")
        return null
      }
      if (result.grupos.length === 0) {
        toast.info("A conta conectada não participa de nenhum grupo.")
      }
      setGrupos(result.grupos)
      return result.grupos
    } finally {
      setCarregando(false)
    }
  }

  async function abrirEscolha(dept: Dept) {
    const lista = await carregarGrupos()
    if (lista) setAlvo(dept)
  }

  function escolher(grupoId: string) {
    const dept = alvo
    if (!dept) return
    startEscolha(async () => {
      const result = await setDepartmentGrupo(dept.id, grupoId)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível salvar o grupo.")
        return
      }
      setAlvo(null)
      toast.success(`Grupo vinculado a ${dept.name}.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={action}
        className="flex items-start gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        <div className="flex-1">
          <Input
            name="name"
            placeholder="Nome do departamento"
            aria-label="Nome do departamento"
          />
          {state?.errors?.name && (
            <p className="mt-1 text-sm text-destructive">
              {state.errors.name[0]}
            </p>
          )}
        </div>
        <AddButton />
      </form>

      <div className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {departments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum departamento cadastrado.
          </p>
        ) : (
          departments.map((d) => (
            <div key={d.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{d.name}</span>{" "}
                  <span className="text-sm text-muted-foreground">
                    · {d.count} colaborador(es)
                  </span>
                </div>
                <ConfirmDelete
                  onConfirm={async () => {
                    await deleteDepartment(d.id)
                  }}
                  title="Excluir departamento"
                  description={`Excluir "${d.name}"? Os colaboradores vinculados ficarão sem departamento.`}
                  successMessage="Departamento excluído."
                />
              </div>
              <GrupoField
                dept={d}
                grupos={grupos}
                onEscolher={abrirEscolha}
              />
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Com um grupo vinculado, o relatório diário do posto é enviado
        automaticamente ao ser finalizado. Use <strong>Escolher</strong> para ver
        os grupos do WhatsApp conectado — ou cole o ID à mão, no formato{" "}
        <code className="font-mono">120263358412332916-group</code>. Não é o
        telefone.
      </p>

      <Dialog open={alvo !== null} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grupo de {alvo?.name}</DialogTitle>
            <DialogDescription>
              Grupos do WhatsApp conectado à Z-API. Clique no grupo que recebe os
              relatórios deste posto.
            </DialogDescription>
          </DialogHeader>

          {grupos && grupos.length > 0 ? (
            <div className="space-y-1">
              {grupos.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={salvandoEscolha}
                  onClick={() => escolher(g.id)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                >
                  <span className="text-sm font-medium">{g.nome}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {g.id}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum grupo encontrado na conta conectada.
            </p>
          )}

          {alvo?.whatsappGrupoId && (
            <Button
              type="button"
              variant="outline"
              disabled={salvandoEscolha}
              onClick={() => escolher("")}
            >
              Desvincular grupo deste posto
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {carregando && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Consultando os grupos na Z-API…
        </p>
      )}
    </div>
  )
}
