import { notFound } from "next/navigation"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { filtroPostoId, podeVerPosto } from "@/lib/permissions"
import { formatDateInput } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { EmployeeForm, type EmployeeValues } from "@/components/rh/employee-form"
import { WhatsappOptOut } from "@/components/rh/whatsapp-optout"

export default async function EditarColaboradorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireModuloEdit("COLABORADORES")

  const [employee, departments, escalas] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.department.findMany({
      where: filtroPostoId(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.escala.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  // Colaborador de posto fora do escopo responde como inexistente: o id na URL
  // não pode virar atalho para o cadastro de outro posto.
  if (!employee || !podeVerPosto(user, employee.departmentId)) notFound()

  const values: EmployeeValues = {
    id: employee.id,
    name: employee.name,
    empresa: employee.empresa,
    matricula: employee.matricula,
    cpf: employee.cpf,
    phone: employee.phone,
    sexo: employee.sexo,
    endereco: employee.endereco,
    cep: employee.cep,
    logradouro: employee.logradouro,
    numero: employee.numero,
    complemento: employee.complemento,
    bairro: employee.bairro,
    cidade: employee.cidade,
    uf: employee.uf,
    departmentId: employee.departmentId,
    status: employee.status,
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
      />
      <WhatsappOptOut
        employeeId={employee.id}
        optOut={employee.whatsappOptOut}
        desde={employee.whatsappOptOutAt?.toISOString() ?? null}
      />
    </div>
  )
}
