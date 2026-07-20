"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createEmployee, updateEmployee } from "@/lib/actions/rh"
import type { FormState } from "@/lib/form"
import { ScheduleEditor } from "@/components/rh/schedule-editor"
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
  matricula: string | null
  cpf: string | null
  email: string | null
  phone: string | null
  position: string | null
  departmentId: string | null
  admissionDate: string | null
  salary: number | null
  status: string
  workSchedule: string | null
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
  canViewSalary,
}: {
  departments: Dept[]
  escalas: Escala[]
  employee?: EmployeeValues
  canViewSalary: boolean
}) {
  const action = employee
    ? updateEmployee.bind(null, employee.id)
    : createEmployee
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  )
  const errors = state?.errors
  const [tipoJornada, setTipoJornada] = useState(
    employee?.escalaId ? "ESCALA" : "SEMANAL"
  )

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
          <Label htmlFor="matricula">Matrícula</Label>
          <Input id="matricula" name="matricula" defaultValue={employee?.matricula ?? ""} />
          <FieldError messages={errors?.matricula} />
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
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
          <FieldError messages={errors?.email} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="position">Cargo</Label>
          <Input id="position" name="position" defaultValue={employee?.position ?? ""} />
          <FieldError messages={errors?.position} />
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
          <Label htmlFor="admissionDate">Data de admissão</Label>
          <Input
            id="admissionDate"
            name="admissionDate"
            type="date"
            defaultValue={employee?.admissionDate ?? ""}
          />
          <FieldError messages={errors?.admissionDate} />
        </div>

        {canViewSalary && (
          <div className="space-y-2">
            <Label htmlFor="salary">Salário (R$)</Label>
            <Input
              id="salary"
              name="salary"
              inputMode="decimal"
              defaultValue={employee?.salary != null ? String(employee.salary) : ""}
              placeholder="0,00"
            />
            <FieldError messages={errors?.salary} />
          </div>
        )}
      </div>

      <div className="space-y-4 border-t pt-5">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="tipoJornada">Tipo de jornada</Label>
          <Select
            value={tipoJornada}
            onValueChange={(v) => setTipoJornada(v ?? "SEMANAL")}
            items={{ SEMANAL: "Semanal fixa", ESCALA: "Escala rotativa" }}
          >
            <SelectTrigger id="tipoJornada" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEMANAL">Semanal fixa</SelectItem>
              <SelectItem value="ESCALA">Escala rotativa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipoJornada === "SEMANAL" ? (
          <ScheduleEditor defaultValue={employee?.workSchedule} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="escalaId">Escala</Label>
              <Select name="escalaId" defaultValue={employee?.escalaId ?? ""}>
                <SelectTrigger id="escalaId" className="w-full">
                  <SelectValue placeholder="Selecione a escala" />
                </SelectTrigger>
                <SelectContent>
                  {escalas.length === 0 && (
                    <SelectItem value="" disabled>
                      Nenhuma escala cadastrada
                    </SelectItem>
                  )}
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
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={employee ? "Salvar alterações" : "Cadastrar"} />
        <BackLink fallbackHref="/rh">Cancelar</BackLink>
      </div>
    </form>
  )
}
