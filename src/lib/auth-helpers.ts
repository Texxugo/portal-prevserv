import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canEdit, canView, type Sector } from "@/lib/permissions"

export async function getSession() {
  return auth()
}

export async function requireUser() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return session.user
}

export async function requireSector(sector: Sector) {
  const user = await requireUser()
  if (!canView(user.role, sector)) redirect("/")
  return user
}

export async function requireSectorEdit(sector: Sector) {
  const user = await requireUser()
  if (!canEdit(user.role, sector)) redirect("/")
  return user
}

// Nome exibido em históricos/auditoria.
export function actorName(user: {
  name?: string | null
  email?: string | null
}): string {
  return user.name || user.email || "Usuário"
}
