"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { createDepartment, deleteDepartment } from "@/lib/actions/rh"
import type { FormState } from "@/lib/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"

type Dept = { id: string; name: string; count: number }

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
  const [state, action] = useActionState<FormState, FormData>(
    createDepartment,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.message === "ok") {
      formRef.current?.reset()
      toast.success("Departamento adicionado.")
    }
  }, [state])

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
            <div
              key={d.id}
              className="flex items-center justify-between px-4 py-3"
            >
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
          ))
        )}
      </div>
    </div>
  )
}
