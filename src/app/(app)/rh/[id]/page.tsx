import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { canViewSalary } from "@/lib/permissions"
import { formatDateInput } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { EmployeeForm, type EmployeeValues } from "@/components/rh/employee-form"

export default async function EditarColaboradorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireSectorEdit("rh")

  const [employee, departments, escalas] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.escala.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  if (!employee) notFound()

  const values: EmployeeValues = {
    id: employee.id,
    name: employee.name,
    matricula: employee.matricula,
    cpf: employee.cpf,
    email: employee.email,
    phone: employee.phone,
    position: employee.position,
    departmentId: employee.departmentId,
    admissionDate: formatDateInput(employee.admissionDate) || null,
    salary: employee.salary,
    status: employee.status,
    workSchedule: employee.workSchedule,
    escalaId: employee.escalaId,
    escalaInicio: formatDateInput(employee.escalaInicio) || null,
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar colaborador" description={employee.name} />
      <EmployeeForm
        departments={departments}
        escalas={escalas}
        employee={values}
        canViewSalary={canViewSalary(user.role)}
      />
    </div>
  )
}
