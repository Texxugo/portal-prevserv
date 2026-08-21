"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createEmployee, updateEmployee } from "@/lib/actions/rh"
import type { FormState } from "@/lib/form"
import { BackLink } from "@/components/back-link"
import { EnderecoFields } from "@/components/geo/endereco-fields"
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

// Base UI Select: `items` mapeia valor → rótulo exibido no gatilho.
const SEXO_ITEMS = { "": "— Não informado —", M: "Masculino", F: "Feminino" }

type Dept = { id: string; name: string }
type Escala = { id: string; name: string }

export type EmployeeValues = {
  id: string
  name: string
  empresa: string | null
  matricula: string | null
  cpf: string | null
  phone: string | null
  sexo: string | null
  endereco: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  departmentId: string | null
  status: string
  escalaId: string | null
  escalaInicio: string | null
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

export function EmployeeForm({
  departments,
  escalas,
  employee,
}: {
  departments: Dept[]
  escalas: Escala[]
  employee?: EmployeeValues
}) {
  const action = employee
    ? updateEmployee.bind(null, employee.id)
    : createEmployee
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  )
  const errors = state?.errors

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" name="name" defaultValue={employee?.name ?? ""} required />
          <FieldError messages={errors?.name} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa</Label>
          <Input id="empresa" name="empresa" defaultValue={employee?.empresa ?? ""} />
          <FieldError messages={errors?.empresa} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="matricula">Matrícula</Label>
          <Input id="matricula" name="matricula" defaultValue={employee?.matricula ?? ""} />
          <FieldError messages={errors?.matricula} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="escalaId">Escala</Label>
          <Select name="escalaId" defaultValue={employee?.escalaId ?? ""}>
            <SelectTrigger id="escalaId" className="w-full">
              <SelectValue placeholder="Selecione a escala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Sem escala —</SelectItem>
              {escalas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.escalaId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="escalaInicio">Início do ciclo</Label>
          <Input
            id="escalaInicio"
            name="escalaInicio"
            type="date"
            defaultValue={employee?.escalaInicio ?? ""}
          />
          <FieldError messages={errors?.escalaInicio} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" name="cpf" defaultValue={employee?.cpf ?? ""} placeholder="000.000.000-00" />
          <FieldError messages={errors?.cpf} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone / WhatsApp</Label>
          <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} placeholder="(00) 00000-0000" />
          <FieldError messages={errors?.phone} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="departmentId">Departamento</Label>
          <Select name="departmentId" defaultValue={employee?.departmentId ?? ""}>
            <SelectTrigger id="departmentId" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Sem departamento —</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.departmentId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Situação</Label>
          <Select name="status" defaultValue={employee?.status ?? "ATIVO"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="AFASTADO">Afastado</SelectItem>
              <SelectItem value="INATIVO">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <FieldError messages={errors?.status} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sexo">Sexo</Label>
          <Select name="sexo" defaultValue={employee?.sexo ?? ""} items={SEXO_ITEMS}>
            <SelectTrigger id="sexo" className="w-full">
              <SelectValue placeholder="Não informado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Não informado —</SelectItem>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Feminino</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define a referência visual do ícone no painel operacional.
          </p>
          <FieldError messages={errors?.sexo} />
        </div>
      </div>

      <div className="space-y-4 border-t pt-5">
        <div>
          <h3 className="text-sm font-medium">Endereço</h3>
          <p className="text-xs text-muted-foreground">
            Vira o alfinete do colaborador no painel operacional e a base do
            cálculo de distância até os postos. Informe o CEP e o número.
          </p>
        </div>

        <EnderecoFields defaults={employee} errors={errors} />

        {/* Cadastro antigo: continua editável porque é o que ainda alimenta a
            geocodificação de quem nunca teve o endereço destrinchado. */}
        <div className="space-y-2">
          <Label htmlFor="endereco">Endereço em texto livre (legado)</Label>
          <Input
            id="endereco"
            name="endereco"
            defaultValue={employee?.endereco ?? ""}
            placeholder="Rua, número, bairro, cidade"
          />
          <FieldError messages={errors?.endereco} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={employee ? "Salvar alterações" : "Cadastrar"} />
        <BackLink fallbackHref="/rh">Cancelar</BackLink>
      </div>
    </form>
  )
}
