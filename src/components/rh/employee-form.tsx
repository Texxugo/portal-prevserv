"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createEmployee, updateEmployee } from "@/lib/actions/rh"
import type { FormState } from "@/lib/form"
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

type Dept = { id: string; name: string }
type Escala = { id: string; name: string }

export type EmployeeValues = {
  id: string
  name: string
  empresa: string | null
  matricula: string | null
  cpf: string | null
  phone: string | null
  endereco: string | null
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

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
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
