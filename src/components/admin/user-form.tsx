"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import type { Role } from "@prisma/client"

import { createUser, updateUser } from "@/lib/actions/users"
import type { FormState } from "@/lib/form"
import {
  MODULOS,
  MODULOS_PADRAO,
  MODULO_GRUPOS,
  ROLE_DESCRICOES,
  ROLE_LABELS,
  type ModuloKey,
} from "@/lib/permissions"
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
  todosPostos: boolean
  modulos: { modulo: string; editar: boolean }[]
  departmentIds: string[]
}

export type PostoOption = { id: string; name: string }

const ROLE_OPTIONS: Role[] = ["ADMIN", "RH", "GESTOR", "VIEWER"]

// O Select desta base precisa do mapa valor→rótulo para exibir o texto no
// gatilho; sem ele o campo mostra o valor cru.
const ROLE_ITEMS = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r, ROLE_LABELS[r]])
)
const STATUS_ITEMS = { true: "Ativo", false: "Inativo" }

type EstadoModulo = { ver: boolean; editar: boolean }

// Usuário novo já nasce com o mínimo do posto marcado; na edição vale o que
// está gravado.
function estadoInicial(user?: UserValues): Record<string, EstadoModulo> {
  const base = Object.fromEntries(
    MODULOS.map((m) => [m.key, { ver: false, editar: false }])
  ) as Record<string, EstadoModulo>

  const origem = user
    ? user.modulos
    : MODULOS_PADRAO.map((m) => ({ modulo: m.modulo as string, editar: m.editar }))

  for (const m of origem) {
    if (base[m.modulo]) base[m.modulo] = { ver: true, editar: m.editar }
  }
  return base
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

export function UserForm({
  user,
  postos,
}: {
  user?: UserValues
  postos: PostoOption[]
}) {
  const action = user ? updateUser.bind(null, user.id) : createUser
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined
  )
  const errors = state?.errors

  const [role, setRole] = useState<Role>(user?.role ?? "VIEWER")
  const [modulos, setModulos] = useState(() => estadoInicial(user))
  const [todosPostos, setTodosPostos] = useState(user?.todosPostos ?? false)

  // ADMIN alcança tudo por definição do perfil: marcar módulo a módulo para ele
  // só criaria a ilusão de que dá para restringir um administrador.
  const admin = role === "ADMIN"

  function alternar(key: ModuloKey, campo: keyof EstadoModulo, valor: boolean) {
    setModulos((prev) => {
      const atual = prev[key]
      const proximo =
        campo === "ver"
          ? { ver: valor, editar: valor && atual.editar }
          : { ver: atual.ver || valor, editar: valor }
      return { ...prev, [key]: proximo }
    })
  }

  return (
    <form action={formAction} className="space-y-5">
      <FieldError messages={errors?._} />

      <section className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
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
            <Label htmlFor="password">{user ? "Nova senha" : "Senha *"}</Label>
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
            <Select
              name="role"
              value={role}
              onValueChange={(v) => setRole(v as Role)}
              items={ROLE_ITEMS}
            >
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
            <p className="text-sm text-muted-foreground">
              {ROLE_DESCRICOES[role]}
            </p>
            <FieldError messages={errors?.role} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="active">Status</Label>
            <Select
              name="active"
              defaultValue={user ? String(user.active) : "true"}
              items={STATUS_ITEMS}
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
      </section>

      <section className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-base font-medium">Módulos liberados</h2>
          <p className="text-sm text-muted-foreground">
            {admin
              ? "Administrador enxerga e edita todos os módulos — não há o que restringir."
              : "Marque o que este usuário enxerga. Sem a marca de edição, o módulo fica só como consulta."}
          </p>
        </div>

        {/* Campo desabilitado não é enviado: para o ADMIN, os campos ocultos
            gravam o que a tela mostra, e rebaixar o perfil depois não deixa o
            usuário sem nenhum módulo. */}
        {admin &&
          MODULOS.map((m) => (
            <div key={m.key}>
              <input type="hidden" name={`mod_${m.key}`} value="on" />
              <input type="hidden" name={`edit_${m.key}`} value="on" />
            </div>
          ))}

        <div className="space-y-5" aria-disabled={admin}>
          {MODULO_GRUPOS.map((grupo) => {
            const doGrupo = MODULOS.filter((m) => m.grupo === grupo)
            if (doGrupo.length === 0) return null
            return (
              <div key={grupo} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {grupo}
                </h3>
                <div className="grid gap-2 lg:grid-cols-2">
                  {doGrupo.map((m) => {
                    const estado = modulos[m.key]
                    const ver = admin || estado.ver
                    const editar = admin || estado.editar
                    return (
                      <div
                        key={m.key}
                        className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5"
                      >
                        <label className="flex items-start gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            name={`mod_${m.key}`}
                            checked={ver}
                            disabled={admin}
                            onChange={(e) =>
                              alternar(m.key, "ver", e.target.checked)
                            }
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <span>
                            {m.label}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {m.descricao}
                            </span>
                          </span>
                        </label>
                        <label className="mt-2 flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            name={`edit_${m.key}`}
                            checked={editar}
                            disabled={admin || !ver}
                            onChange={(e) =>
                              alternar(m.key, "editar", e.target.checked)
                            }
                            className="size-3.5 accent-primary"
                          />
                          {m.edicaoLabel}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-base font-medium">Postos que o usuário enxerga</h2>
          <p className="text-sm text-muted-foreground">
            Vale para efetivos, relatórios, colaboradores e movimentos: fora
            desta lista, o registro não aparece nem pela URL.
          </p>
        </div>

        <input type="hidden" name="todosPostos" value={String(todosPostos)} />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={todosPostos}
              onChange={() => setTodosPostos(true)}
              className="size-4 accent-primary"
            />
            Todos os postos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!todosPostos}
              onChange={() => setTodosPostos(false)}
              className="size-4 accent-primary"
            />
            Somente os postos marcados
          </label>
        </div>

        {!todosPostos &&
          (postos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum posto cadastrado ainda.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {postos.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm ring-1 ring-foreground/5"
                >
                  <input
                    type="checkbox"
                    name="postos"
                    value={p.id}
                    defaultChecked={user?.departmentIds.includes(p.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="truncate uppercase">{p.name}</span>
                </label>
              ))}
            </div>
          ))}
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton label={user ? "Salvar alterações" : "Criar usuário"} />
        <ButtonLink variant="ghost" href="/admin/usuarios">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  )
}
