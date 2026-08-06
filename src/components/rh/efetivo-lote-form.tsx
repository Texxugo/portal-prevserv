"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react"

import { createEfetivo } from "@/lib/actions/efetivos"
import type { EmployeeOption } from "@/lib/efetivo-options"
import type { FormState } from "@/lib/form"
import { EFETIVO_EVENTO_SEM_ALTERACAO, EFETIVO_EVENTOS } from "@/lib/schemas"
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

// 1 linha = 1 pessoa numa função, com evento e extra próprios. Data, período e
// a pergunta de documento valem para o lote inteiro.
type Linha = {
  key: number
  local: string
  employeeId: string | null
  freelancerName: string | null
  horarioEntrada: string
  horarioSaida: string
  evento: string
  extra: boolean
}

const PERIODO_OPTIONS: { value: string; label: string }[] = [
  { value: "DIURNO", label: "Diurno" },
  { value: "NOTURNO", label: "Noturno" },
]

let proximaKey = 1
function novaLinha(): Linha {
  return {
    key: proximaKey++,
    local: "",
    employeeId: null,
    freelancerName: null,
    horarioEntrada: "",
    horarioSaida: "",
    evento: EFETIVO_EVENTO_SEM_ALTERACAO,
    extra: false,
  }
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

function SubmitButton({ total }: { total: number }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {total > 1 ? `Cadastrar ${total} efetivos` : "Cadastrar"}
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

// Combobox de pessoa: escolhe um colaborador ou, se o nome não existir na
// lista, permite usar o que foi digitado como freelancer.
function PessoaField({
  employees,
  linha,
  onChange,
}: {
  employees: EmployeeOption[]
  linha: Linha
  onChange: (patch: Partial<Linha>) => void
}) {
  const filter = useComboboxFilter()
  const [query, setQuery] = useState("")

  if (linha.freelancerName) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
        <span className="flex-1 truncate">{linha.freelancerName}</span>
        <span className="text-xs text-muted-foreground">freelancer</span>
        <button
          type="button"
          onClick={() => onChange({ freelancerName: null })}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Remover freelancer"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    )
  }

  const selecionado =
    employees.find((e) => e.value === linha.employeeId) ?? null

  return (
    <Combobox
      items={employees}
      value={selecionado}
      onValueChange={(v: EmployeeOption | null) =>
        onChange({ employeeId: v?.value ?? null })
      }
      onInputValueChange={setQuery}
      isItemEqualToValue={(a: EmployeeOption, b: EmployeeOption) =>
        a?.value === b?.value
      }
      filter={(item: EmployeeOption, q: string) =>
        filter.contains(item.label, q) ||
        (!!item.matricula && filter.contains(item.matricula, q))
      }
      autoHighlight
    >
      <ComboboxInput placeholder="Pesquisar colaborador…" />
      <ComboboxContent>
        <ComboboxEmpty>
          <div className="space-y-2">
            <p>Nenhum colaborador encontrado.</p>
            {query.trim() && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    freelancerName: query.trim(),
                    employeeId: null,
                  })
                }
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <UserPlus className="size-3.5" />
                Usar “{query.trim()}” como freelancer
              </button>
            )}
          </div>
        </ComboboxEmpty>
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
    </Combobox>
  )
}

export function EfetivoLoteForm({
  employees,
  baseEmployees,
  departmentId,
  departmentName,
}: {
  employees: EmployeeOption[]
  baseEmployees: EmployeeOption[]
  departmentId: string
  departmentName: string
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createEfetivo,
    undefined
  )
  const errors = state?.errors

  const [linhas, setLinhas] = useState<Linha[]>(() => [novaLinha()])
  const [temDocumento, setTemDocumento] = useState<"sim" | "nao" | null>(null)
  const [baseOperacional, setBaseOperacional] = useState<EmployeeOption | null>(
    null
  )
  // a pergunta de documento vale para o lote: basta uma linha com evento
  const exigeDocumento = linhas.some(
    (l) => l.evento !== EFETIVO_EVENTO_SEM_ALTERACAO
  )

  const baseFilter = useComboboxFilter()

  const periodoItems = Object.fromEntries(
    PERIODO_OPTIONS.map((p) => [p.value, p.label])
  )
  const eventoItems = Object.fromEntries(EFETIVO_EVENTOS.map((e) => [e, e]))

  function patchLinha(key: number, patch: Partial<Linha>) {
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  // quantidade é dinâmica → vai num campo JSON só (key é só do React).
  // Campos vazios viram "" e não null: o Zod do projeto trata texto opcional
  // como string vazia, igual ao que o FormData enviaria.
  const linhasJson = JSON.stringify(
    linhas.map((l) => ({
      local: l.local,
      employeeId: l.employeeId ?? "",
      freelancerName: l.freelancerName ?? "",
      horarioEntrada: l.horarioEntrada,
      horarioSaida: l.horarioSaida,
      evento: l.evento,
      extra: l.extra,
    }))
  )

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
    >
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="linhas" value={linhasJson} />
      <input
        type="hidden"
        name="baseOperacionalId"
        value={baseOperacional?.value ?? ""}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Posto</Label>
          <Input value={departmentName.toUpperCase()} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Data *</Label>
          <Input id="date" name="date" type="date" required />
          <FieldError messages={errors?.date} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="periodo">Período *</Label>
          <Select name="periodo" defaultValue="DIURNO" items={periodoItems}>
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
          <Label htmlFor="baseOperacional">Base operacional</Label>
          <Combobox
            items={baseEmployees}
            value={baseOperacional}
            onValueChange={setBaseOperacional}
            isItemEqualToValue={(a: EmployeeOption, b: EmployeeOption) =>
              a?.value === b?.value
            }
            filter={(item: EmployeeOption, q: string) =>
              baseFilter.contains(item.label, q) ||
              (!!item.matricula && baseFilter.contains(item.matricula, q))
            }
            autoHighlight
          >
            <ComboboxInput
              id="baseOperacional"
              placeholder={
                baseEmployees.length
                  ? "Pesquisar na base…"
                  : "Nenhum colaborador lotado na base"
              }
            />
            <ComboboxContent>
              <ComboboxEmpty>Nenhum colaborador encontrado.</ComboboxEmpty>
              <ComboboxList>
                {(item: EmployeeOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <p className="text-xs text-muted-foreground">
            Opcional. Sai no cabeçalho da mensagem do grupo.
          </p>
          <FieldError messages={errors?.baseOperacionalId} />
        </div>
      </div>

      <div className="space-y-3" data-tour="efet-linhas">
        <div className="flex items-center justify-between">
          <Label>Colaboradores por função *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinhas((prev) => [...prev, novaLinha()])}
          >
            <Plus className="size-4" />
            Adicionar linha
          </Button>
        </div>

        <div className="space-y-2">
          {linhas.map((linha, i) => (
            <div
              key={linha.key}
              className="space-y-2 rounded-lg bg-muted/40 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto] sm:items-center">
                <Input
                  placeholder="Função (ex.: Portaria social)"
                  value={linha.local}
                  onChange={(e) =>
                    patchLinha(linha.key, { local: e.target.value })
                  }
                  aria-label={`Função da linha ${i + 1}`}
                />
                <PessoaField
                  employees={employees}
                  linha={linha}
                  onChange={(patch) => patchLinha(linha.key, patch)}
                />
                <Input
                  type="time"
                  value={linha.horarioEntrada}
                  onChange={(e) =>
                    patchLinha(linha.key, { horarioEntrada: e.target.value })
                  }
                  aria-label={`Entrada da linha ${i + 1}`}
                />
                <Input
                  type="time"
                  value={linha.horarioSaida}
                  onChange={(e) =>
                    patchLinha(linha.key, { horarioSaida: e.target.value })
                  }
                  aria-label={`Saída da linha ${i + 1}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={linha.evento}
                  onValueChange={(v) =>
                    patchLinha(linha.key, {
                      evento: v ?? EFETIVO_EVENTO_SEM_ALTERACAO,
                    })
                  }
                  items={eventoItems}
                >
                  <SelectTrigger
                    className="w-44"
                    aria-label={`Evento da linha ${i + 1}`}
                  >
                    <SelectValue placeholder="Evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {EFETIVO_EVENTOS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={linha.extra}
                    onChange={(e) =>
                      patchLinha(linha.key, { extra: e.target.checked })
                    }
                    className="size-4 accent-primary"
                    aria-label={`Extra da linha ${i + 1}`}
                  />
                  Extra
                </label>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={linhas.length === 1}
                  onClick={() =>
                    setLinhas((prev) => prev.filter((l) => l.key !== linha.key))
                  }
                  aria-label={`Remover linha ${i + 1}`}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <FieldError messages={errors?.linhas} />
      </div>

      <div className="grid gap-5">
        {exigeDocumento && (
          <div
            className="space-y-3 rounded-lg bg-muted/50 p-4"
            data-tour="efet-documento"
          >
            <Label>Existe documento referente ao(s) evento(s)? *</Label>
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
                Uma pendência de documento será criada para cada linha com
                evento, para acompanhamento em Pendências documentais.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton total={linhas.length + (baseOperacional ? 1 : 0)} />
        <BackLink fallbackHref={`/rh/efetivos/${departmentId}`}>
          Cancelar
        </BackLink>
      </div>
    </form>
  )
}
