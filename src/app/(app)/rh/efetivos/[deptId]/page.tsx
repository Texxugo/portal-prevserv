import { notFound } from "next/navigation"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { baseDepartmentIds } from "@/lib/efetivo-options"
import { formatDate, formatDateInput } from "@/lib/format"
import { canEdit } from "@/lib/permissions"
import { buildEfetivoGrupoMessage } from "@/lib/whatsapp/templates"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DateFilter } from "@/components/date-filter"
import { EfetivoWhatsappCard } from "@/components/rh/efetivo-whatsapp-card"
import {
  EfetivosTable,
  type EfetivoRow,
} from "@/components/rh/efetivos-table"

export default async function EfetivosDepartamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ deptId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const user = await requireSector("rh")
  const editable = canEdit(user.role, "rh")

  const { deptId } = await params
  const { date } = await searchParams
  const dateStr = date || formatDateInput(new Date())

  const [department, baseIds] = await Promise.all([
    prisma.department.findUnique({
      where: { id: deptId },
      select: { id: true, name: true, whatsappGrupoId: true },
    }),
    baseDepartmentIds(),
  ])
  if (!department) notFound()

  const efetivos = await prisma.efetivo.findMany({
    where: { departmentId: department.id, date: new Date(dateStr) },
    include: {
      employee: { select: { name: true, departmentId: true } },
      documentPendencias: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
    orderBy: [{ periodo: "asc" }, { createdAt: "asc" }],
  })

  const rows: EfetivoRow[] = efetivos.map((e) => ({
    id: e.id,
    departmentId: department.id,
    pessoa: e.employee?.name ?? e.freelancerName ?? "—",
    freelancer: !e.employeeId,
    horario: e.horario,
    local: e.local,
    evento: e.evento,
    periodo: e.periodo,
    extra: e.extra,
    documentoStatus: e.documentPendencias[0]?.status ?? null,
  }))

  // Uma mensagem por período presente na data: quem veio do posto BASE sobe
  // para a linha "Base operacional" em vez de virar linha de função.
  const mensagens = ["DIURNO", "NOTURNO"]
    .map((periodo) => {
      const doPeriodo = efetivos.filter((e) => e.periodo === periodo)
      if (!doPeriodo.length) return null

      const daBase = (e: (typeof doPeriodo)[number]) =>
        !!e.employee?.departmentId && baseIds.includes(e.employee.departmentId)

      return {
        periodo,
        texto: buildEfetivoGrupoMessage({
          posto: department.name,
          date: new Date(dateStr),
          periodo,
          baseOperacional: doPeriodo
            .filter(daBase)
            .map((e) => e.employee!.name),
          linhas: doPeriodo
            .filter((e) => !daBase(e))
            .map((e) => ({
              nome: e.employee?.name ?? e.freelancerName ?? "—",
              local: e.local,
              horario: e.horario,
              freelancer: !e.employeeId,
            })),
        }),
      }
    })
    .filter((m) => m !== null)

  return (
    <div className="space-y-6">
      <PageHeader
        title={department.name.toUpperCase()}
        description={`Efetivos do posto em ${formatDate(new Date(dateStr))}.`}
      >
        <ButtonLink variant="outline" href="/rh/efetivos">
          Todos os postos
        </ButtonLink>
        <ButtonLink
          variant="outline"
          href={`/rh/efetivos/${department.id}/relatorio?date=${dateStr}`}
        >
          Relatório diário
        </ButtonLink>
        <DateFilter value={dateStr} />
        {editable && (
          <ButtonLink
            href={`/rh/efetivos/${department.id}/novo`}
            data-tour="efet-novo"
          >
            Novo efetivo
          </ButtonLink>
        )}
      </PageHeader>
      {mensagens.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {mensagens.map((m) => (
            <EfetivoWhatsappCard
              key={m.periodo}
              periodo={m.periodo}
              message={m.texto}
              departmentId={department.id}
              temGrupo={!!department.whatsappGrupoId}
            />
          ))}
        </div>
      )}
      <div data-tour="efet-tabela">
        <EfetivosTable data={rows} canEdit={editable} />
      </div>
    </div>
  )
}
