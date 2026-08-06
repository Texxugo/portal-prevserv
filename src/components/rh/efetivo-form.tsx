"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { updateEfetivo } from "@/lib/actions/efetivos"
import type { EmployeeOption } from "@/lib/efetivo-options"
import type { FormState } from "@/lib/form"
import {
  EFETIVO_EVENTOS,
  normalizeEvento,
} from "@/lib/schemas"
import { BackLink } from "@/components/back-link"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxFilter,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const comparaEmployee = (a: EmployeeOption, b: EmployeeOption) =>
  a?.value === b?.value

// Popup compartilhado pelos modos único (edição) e múltiplo (cadastro).
function ListaColaboradores() {
  return (
    <ComboboxContent>
      <ComboboxEmpty>Nenhum colaborador encontrado.</ComboboxEmpty>
      <ComboboxList>
        {(item: EmployeeOption) => (
          <ComboboxItem key={item.value} value={item}>
            <span className="flex-1 truncate">{item.label}</span>
            {item.base && (
              <span className="text-xs text-muted-foreground">BASE</span>
            )}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  )
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

// Edição de 1 registro. O cadastro (em lote) fica em efetivo-lote-form.tsx.
export function EfetivoForm({
  employees,
  departmentId,
  departmentName,
  efetivo,
}: {
  employees: EmployeeOption[]
  departmentId: string
  departmentName: string
  efetivo: EfetivoValues
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateEfetivo.bind(null, efetivo.id),
    undefined
  )
  const errors = state?.errors

  const [tipoPessoa, setTipoPessoa] = useState<"funcionario" | "freelancer">(
    efetivo.freelancerName ? "freelancer" : "funcionario"
  )
  const [evento, setEvento] = useState(normalizeEvento(efetivo.evento))
  const horario = splitHorario(efetivo.horario)

  const filter = useComboboxFilter()
  const selectedEmployee =
    employees.find((e) => e.value === efetivo?.employeeId) ?? null
  const filtraEmployee = (item: EmployeeOption, query: string) =>
    filter.contains(item.label, query) ||
    (!!item.matricula && filter.contains(item.matricula, query))

  // Base UI Select: `items` mapeia valor → rótulo exibido no trigger
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
            <Combobox
              name="employeeId"
              items={employees}
              defaultValue={selectedEmployee}
              isItemEqualToValue={comparaEmployee}
              filter={filtraEmployee}
              autoHighlight
            >
              <ComboboxInput
                id="employeeId"
                placeholder="Pesquisar colaborador…"
              />
              <ListaColaboradores />
            </Combobox>
            <FieldError messages={errors?.employeeId} />
          </div>
        ) : (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="freelancerName">Nome do freelancer *</Label>
            <Input
              id="freelancerName"
              name="freelancerName"
              defaultValue={efetivo.freelancerName ?? ""}
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

      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label="Salvar alterações" />
        <BackLink fallbackHref={`/rh/efetivos/${departmentId}`}>
          Cancelar
        </BackLink>
      </div>
    </form>
  )
}
