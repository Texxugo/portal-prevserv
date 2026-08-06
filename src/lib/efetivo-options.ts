import { prisma } from "@/lib/db"

export type EmployeeOption = {
  value: string // Employee.id — submetido no campo employeeId
  label: string // Employee.name — exibido no input
  matricula: string | null
  base: boolean // vem do posto BASE (dica visual na lista)
}

// Regra de plantão: além dos colaboradores do posto, entram na busca os do
// posto da base — nome "BASE" ou começando por "BASE " (ex.: "BASE
// OPERACIONAL"; criado em runtime, e Prisma+SQLite não tem equals
// case-insensitive, então a comparação de nome é feita aqui).
export async function baseDepartmentIds(): Promise<string[]> {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
  })
  return departments
    .filter((d) => {
      const n = d.name.trim().toUpperCase()
      return n === "BASE" || n.startsWith("BASE ")
    })
    .map((d) => d.id)
}

type EmployeeRow = {
  id: string
  name: string
  matricula: string | null
  departmentId: string | null
}

export function employeeOptions(
  rows: EmployeeRow[],
  deptId: string,
  baseIds: string[]
): EmployeeOption[] {
  return rows.map((e) => ({
    value: e.id,
    label: e.name,
    matricula: e.matricula,
    base:
      e.departmentId !== deptId &&
      e.departmentId !== null &&
      baseIds.includes(e.departmentId),
  }))
}

// Campo "Base Operacional": só quem está lotado no posto da base.
export function baseEmployeeOptions(
  rows: EmployeeRow[],
  baseIds: string[]
): EmployeeOption[] {
  return rows
    .filter((e) => e.departmentId !== null && baseIds.includes(e.departmentId))
    .map((e) => ({
      value: e.id,
      label: e.name,
      matricula: e.matricula,
      base: true,
    }))
}
