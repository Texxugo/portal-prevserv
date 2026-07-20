import { Role } from "@prisma/client"

export type Sector = "rh" | "admin"

// Quem pode VER cada setor
const VIEW: Record<Sector, Role[]> = {
  rh: ["ADMIN", "RH", "GESTOR"],
  admin: ["ADMIN"],
}

// Quem pode EDITAR (criar/alterar/excluir) cada setor — GESTOR é somente leitura
const EDIT: Record<Sector, Role[]> = {
  rh: ["ADMIN", "RH"],
  admin: ["ADMIN"],
}

export function canView(role: Role | undefined | null, sector: Sector): boolean {
  return !!role && VIEW[sector].includes(role)
}

export function canEdit(role: Role | undefined | null, sector: Sector): boolean {
  return !!role && EDIT[sector].includes(role)
}

// Campo sensível (salário) só para RH/ADMIN
export function canViewSalary(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "RH"
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  RH: "RH",
  GESTOR: "Gestor (leitura)",
  VIEWER: "Visualizador",
}
