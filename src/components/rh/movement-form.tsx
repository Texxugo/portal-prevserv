"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createMovement, updateMovement } from "@/lib/actions/movements"
import type { FormState } from "@/lib/form"
import { BackLink } from "@/components/back-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Employee = { id: string; name: string }

export type MovementValues = {
  id: string
  employeeId: string
  type: string
  justificada: boolean | null
  startDate: string
  endDate: string | null
  note: string | null
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "FALTA", label: "Falta" },
  { value: "FERIAS", label: "Férias" },
  { value: "CONTRATACAO", label: "Contratação" },
  { value: "DEMISSAO", label: "Demissão" },
]

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  )
}

export function MovementForm({
  employees,
  movement,
}: {
  employees: Employee[]
  movement?: MovementValues
}) {
  const action = movement
    ? updateMovement.bind(null, movement.id)
    : createMovement
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  )
  const errors = state?.errors

  const [type, setType] = useState(movement?.type ?? "FALTA")
  const justificadaDefault =
    movement?.justificada === true
      ? "true"
      : movement?.justificada === false
        ? "false"
        : "false"

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="employeeId">Colaborador *</Label>
          <Select name="employeeId" defaultValue={movement?.employeeId ?? ""}>
            <SelectTrigger id="employeeId" className="w-full">
              <SelectValue placeholder="Selecione o colaborador" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.employeeId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo *</Label>
          <Select
            name="type"
            defaultValue={type}
            onValueChange={(v) => setType(v ?? "")}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.type} />
        </div>

        {type === "FALTA" && (
          <div className="space-y-2">
            <Label htmlFor="justificada">Justificada</Label>
            <Select name="justificada" defaultValue={justificadaDefault}>
              <SelectTrigger id="justificada" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Não</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="startDate">Data início *</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={movement?.startDate ?? ""}
            required
          />
          <FieldError messages={errors?.startDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">Data fim</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={movement?.endDate ?? ""}
          />
          <FieldError messages={errors?.endDate} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Observação</Label>
          <Textarea
            id="note"
            name="note"
            defaultValue={movement?.note ?? ""}
            rows={3}
          />
          <FieldError messages={errors?.note} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={movement ? "Salvar alterações" : "Cadastrar"} />
        <BackLink fallbackHref="/rh/movimentos">Cancelar</BackLink>
      </div>
    </form>
  )
}
