"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createEfetivo, updateEfetivo } from "@/lib/actions/efetivos"
import type { FormState } from "@/lib/form"
import {
  EFETIVO_EVENTO_SEM_ALTERACAO,
  EFETIVO_EVENTOS,
} from "@/lib/schemas"
import { BackLink } from "@/components/back-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Option = { id: string; name: string }

export type EfetivoValues = {
  id: string
  employeeId: string | null
  freelancerName: string | null
  departmentId: string
  date: string
  horario: string | null
  local: string | null
  evento: string | null
  periodo: string
  extra: boolean
}

const PERIODO_OPTIONS: { value: string; label: string }[] = [
  { value: "DIURNO", label: "Diurno" },
  { value: "NOTURNO", label: "Noturno" },
]

function normalizeEvento(evento?: string | null) {
  return evento === "AS TE" ? "TE" : evento ?? ""
}

function splitHorario(horario?: string | null) {
  const matches = horario?.match(/\b\d{2}:\d{2}\b/g) ?? []
  return {
    entrada: matches[0] ?? "",
    saida: matches[1] ?? "",
    legacy: matches.length ? "" : horario ?? "",
  }
}

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

function Radio({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string
  value: string
  label: string
  checked: boolean
  onChange?: () => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}

export function EfetivoForm({
  employees,
  departmentId,
  departmentName,
  efetivo,
}: {
  employees: Option[]
  departmentId: string
  departmentName: string
  efetivo?: EfetivoValues
}) {
  const action = efetivo ? updateEfetivo.bind(null, efetivo.id) : createEfetivo
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  )
  const errors = state?.errors

  const [tipoPessoa, setTipoPessoa] = useState<"funcionario" | "freelancer">(
    efetivo?.freelancerName ? "freelancer" : "funcionario"
  )
  const [temDocumento, setTemDocumento] = useState<"sim" | "nao" | null>(null)
  const [evento, setEvento] = useState(normalizeEvento(efetivo?.evento))
  const horario = splitHorario(efetivo?.horario)
  const isSemAlteracao = evento === EFETIVO_EVENTO_SEM_ALTERACAO

  // Base UI Select: `items` mapeia valor → rótulo exibido no trigger
  const employeeItems = Object.fromEntries(employees.map((e) => [e.id, e.name]))
  const periodoItems = Object.fromEntries(
    PERIODO_OPTIONS.map((p) => [p.value, p.label])
  )
  const eventoItems = Object.fromEntries(EFETIVO_EVENTOS.map((e) => [e, e]))

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
    >
      <input type="hidden" name="departmentId" value={departmentId} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2" data-tour="efet-tipo-pessoa">
          <Label>Tipo de profissional</Label>
          <div className="flex items-center gap-6">
            <Radio
              name="tipoPessoa"
              value="funcionario"
              label="Funcionário cadastrado"
              checked={tipoPessoa === "funcionario"}
              onChange={() => setTipoPessoa("funcionario")}
            />
            <Radio
              name="tipoPessoa"
              value="freelancer"
              label="Freelancer"
              checked={tipoPessoa === "freelancer"}
              onChange={() => setTipoPessoa("freelancer")}
            />
          </div>
        </div>

        {tipoPessoa === "funcionario" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="employeeId">Funcionário *</Label>
            <Select
              name="employeeId"
              defaultValue={efetivo?.employeeId ?? ""}
              items={employeeItems}
            >
              <SelectTrigger id="employeeId" className="w-full">
                <SelectValue placeholder="Selecione o funcionário" />
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
        ) : (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="freelancerName">Nome do freelancer *</Label>
            <Input
              id="freelancerName"
              name="freelancerName"
              defaultValue={efetivo?.freelancerName ?? ""}
              placeholder="Nome completo do freelancer"
            />
            <FieldError
              messages={errors?.freelancerName ?? errors?.employeeId}
            />
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label>Posto</Label>
          <Input value={departmentName.toUpperCase()} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Data *</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={efetivo?.date ?? ""}
            required
          />
          <FieldError messages={errors?.date} />
        </div>

        <input type="hidden" name="horario" value={horario.legacy} />

        <div className="space-y-2">
          <Label htmlFor="horarioEntrada">Horário de entrada</Label>
          <Input
            id="horarioEntrada"
            name="horarioEntrada"
            type="time"
            defaultValue={horario.entrada}
          />
          <FieldError messages={errors?.horarioEntrada ?? errors?.horario} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="horarioSaida">Horário de saída</Label>
          <Input
            id="horarioSaida"
            name="horarioSaida"
            type="time"
            defaultValue={horario.saida}
          />
          <FieldError messages={errors?.horarioSaida} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="local">Local</Label>
          <Input
            id="local"
            name="local"
            defaultValue={efetivo?.local ?? ""}
            placeholder="Local específico de atuação"
          />
          <FieldError messages={errors?.local} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="evento">Evento *</Label>
          <Select
            name="evento"
            value={evento}
            onValueChange={(v) => setEvento(v ?? "")}
            items={eventoItems}
          >
            <SelectTrigger id="evento" className="w-full">
              <SelectValue placeholder="Selecione o evento" />
            </SelectTrigger>
            <SelectContent>
              {EFETIVO_EVENTOS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.evento} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="periodo">Período *</Label>
          <Select
            name="periodo"
            defaultValue={efetivo?.periodo ?? "DIURNO"}
            items={periodoItems}
          >
            <SelectTrigger id="periodo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODO_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.periodo} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="extra"
              defaultChecked={efetivo?.extra ?? false}
              className="size-4 accent-primary"
            />
            Extra
          </label>
        </div>

        {!efetivo && !isSemAlteracao && (
          <div
            className="space-y-3 rounded-lg bg-muted/50 p-4 sm:col-span-2"
            data-tour="efet-documento"
          >
            <Label>Existe documento referente a este evento? *</Label>
            <div className="flex items-center gap-6">
              <Radio
                name="temDocumento"
                value="sim"
                label="Sim"
                checked={temDocumento === "sim"}
                onChange={() => setTemDocumento("sim")}
              />
              <Radio
                name="temDocumento"
                value="nao"
                label="Não"
                checked={temDocumento === "nao"}
                onChange={() => setTemDocumento("nao")}
              />
            </div>
            <FieldError messages={errors?.temDocumento} />

            {temDocumento === "sim" && (
              <div className="space-y-2">
                <Label htmlFor="documentoUrl">Link do documento *</Label>
                <Input
                  id="documentoUrl"
                  name="documentoUrl"
                  type="url"
                  placeholder="https://..."
                />
                <FieldError messages={errors?.documentoUrl} />
              </div>
            )}
            {temDocumento === "nao" && (
              <p className="text-sm text-muted-foreground">
                Uma pendência de documento será criada automaticamente para
                acompanhamento em Pendências documentais.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={efetivo ? "Salvar alterações" : "Cadastrar"} />
        <BackLink fallbackHref={`/rh/efetivos/${departmentId}`}>
          Cancelar
        </BackLink>
      </div>
    </form>
  )
}
