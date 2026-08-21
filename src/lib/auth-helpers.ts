import { cache } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import {
  isModuloKey,
  podeEditar,
  podeVer,
  podeVerPosto,
  type Access,
  type ModuloKey,
} from "@/lib/permissions"

export async function getSession() {
  return auth()
}

export async function requireUser() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return session.user
}

// A permissão vem do banco a cada requisição, não do JWT: alterar o acesso de
// alguém precisa valer no próximo clique, sem esperar o usuário sair e entrar.
// O cache() do React garante uma única consulta por requisição.
export const getAccess = cache(async (): Promise<Access | null> => {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      todosPostos: true,
      modulos: { select: { modulo: true, editar: true } },
      departments: { select: { departmentId: true } },
    },
  })
  // Usuário desativado no meio da sessão perde o acesso na hora.
  if (!user || !user.active) return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    todosPostos: user.todosPostos,
    modulos: user.modulos
      .filter((m) => isModuloKey(m.modulo))
      .map((m) => ({ modulo: m.modulo as ModuloKey, editar: m.editar })),
    departmentIds: user.departments.map((d) => d.departmentId),
  }
})

export async function requireAccess(): Promise<Access> {
  const access = await getAccess()
  if (!access) redirect("/login")
  return access
}

export async function requireModulo(modulo: ModuloKey): Promise<Access> {
  const access = await requireAccess()
  if (!podeVer(access, modulo)) redirect("/")
  return access
}

export async function requireModuloEdit(modulo: ModuloKey): Promise<Access> {
  const access = await requireAccess()
  if (!podeEditar(access, modulo)) redirect("/")
  return access
}

// Página de um posto específico: além do módulo, o posto precisa estar no
// escopo do usuário. Sem isso, trocar o id na URL daria acesso a qualquer posto.
export async function requirePosto(
  modulo: ModuloKey,
  departmentId: string
): Promise<Access> {
  const access = await requireModulo(modulo)
  if (!podeVerPosto(access, departmentId)) redirect("/rh/efetivos")
  return access
}

export async function requirePostoEdit(
  modulo: ModuloKey,
  departmentId: string
): Promise<Access> {
  const access = await requireModuloEdit(modulo)
  if (!podeVerPosto(access, departmentId)) redirect("/rh/efetivos")
  return access
}

// Variante para server actions que respondem { ok, error } em vez de redirecionar.
export async function checkPostoEdit(
  modulo: ModuloKey,
  departmentId: string
): Promise<{ access: Access } | { erro: string }> {
  const access = await getAccess()
  if (!podeEditar(access, modulo)) {
    return { erro: "Você não tem permissão para esta ação." }
  }
  if (!podeVerPosto(access, departmentId)) {
    return { erro: "Este posto não está no seu acesso." }
  }
  return { access: access as Access }
}

// Nome exibido em históricos/auditoria.
export function actorName(user: {
  name?: string | null
  email?: string | null
}): string {
  return user.name || user.email || "Usuário"
}
