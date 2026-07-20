"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import type { Role } from "@prisma/client"

import { createUser, updateUser } from "@/lib/actions/users"
import type { FormState } from "@/lib/form"
import { ROLE_LABELS } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/button-link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type UserValues = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
}

const ROLE_OPTIONS: Role[] = ["ADMIN", "RH", "GESTOR", "VIEWER"]

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

export function UserForm({ user }: { user?: UserValues }) {
  const action = user ? updateUser.bind(null, user.id) : createUser
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
          <Input id="name" name="name" defaultValue={user?.name ?? ""} required />
          <FieldError messages={errors?.name} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={user?.email ?? ""}
            required
          />
          <FieldError messages={errors?.email} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {user ? "Nova senha" : "Senha *"}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={user ? "Deixe em branco para manter" : ""}
            required={!user}
          />
          <FieldError messages={errors?.password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Perfil *</Label>
          <Select name="role" defaultValue={user?.role ?? "VIEWER"}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={errors?.role} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="active">Status</Label>
          <Select
            name="active"
            defaultValue={user ? String(user.active) : "true"}
          >
            <SelectTrigger id="active" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Ativo</SelectItem>
              <SelectItem value="false">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={user ? "Salvar alterações" : "Criar usuário"} />
        <ButtonLink variant="ghost" href="/admin/usuarios">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  )
}
