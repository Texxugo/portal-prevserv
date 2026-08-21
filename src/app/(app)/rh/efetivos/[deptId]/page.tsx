import { notFound } from "next/navigation"

import { requirePosto } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { diasAte, EFETIVO_PERIODOS } from "@/lib/efetivo-cobertura"
import {
  carregarCobertura,
  carregarTurnosEsperados,
  turnoDe,
} from "@/lib/efetivo-cobertura-db"
import { baseDepartmentIds } from "@/lib/efetivo-options"
import { formatDate, formatDateInput } from "@/lib/format"
import { podeEditar, verTodosPostos } from "@/lib/permissions"
import { buildEfetivoGrupoMessage } from "@/lib/whatsapp/templates"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DateFilter } from "@/components/date-filter"
import { EfetivoHistorico } from "@/components/rh/efetivo-historico"
import { EfetivoLembrete } from "@/components/rh/efetivo-lembrete"
import { EfetivoWhatsappCard } from "@/components/rh/efetivo-whatsapp-card"
import {
  EfetivosTable,
  type EfetivoRow,
} from "@/components/rh/efetivos-table"

// Janela do histórico curto do posto. Duas semanas cobrem a escala 12x36 e a
// consulta é agregada, então não cresce com o número de pessoas.
const HISTORICO_DIAS = 14

export default async function EfetivosDepartamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ deptId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { deptId } = await params
  const user = await requirePosto("EFETIVOS", deptId)
  const editable = podeEditar(user, "EFETIVOS")

  // Quem opera preso a um posto lança o efetivo e envia o texto ao grupo — a
  // grade linha a linha é conferência de quem acompanha vários postos. Sem ela,
  // o operacional continua incluindo e conferindo, mas corrigir uma linha já
  // lançada passa a ser tarefa de quem enxerga todos os postos.
  const mostrarTabela = verTodosPostos(user)

  const { date } = await searchParams
  const hojeStr = formatDateInput(new Date())
  const dateStr = date || hojeStr

  const [department, baseIds] = await Promise.all([
    prisma.department.findUnique({
      where: { id: deptId },
      select: { id: true, name: true, whatsappGrupoId: true },
    }),
    baseDepartmentIds(),
  ])
  if (!department) notFound()

  // Histórico e lembrete saem de agregações (contagem por dia/turno), não da
  // listagem: nenhuma das duas telas precisa dos registros linha a linha.
  const diasHistorico = diasAte(dateStr, HISTORICO_DIAS)
  const [cobertura, esperadosPorPosto] = await Promise.all([
    carregarCobertura(diasHistorico, department.id),
    carregarTurnosEsperados(dateStr, department.id),
  ])
  const esperados: string[] = esperadosPorPosto.get(department.id) ?? []

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

  const turnosLembrete = EFETIVO_PERIODOS.map((periodo) => {
    const t = turnoDe(cobertura, department.id, dateStr, periodo)
    return {
      periodo,
      total: t.total,
      atualizadoEm: t.atualizadoEm?.toISOString() ?? null,
      confirmadoEm: t.confirmadoEm?.toISOString() ?? null,
      confirmadoPor: t.confirmadoPor,
    }
  })

  const historico = diasHistorico.map((dia) => ({
    dateStr: dia,
    turnos: EFETIVO_PERIODOS.map((periodo) => {
      const t = turnoDe(cobertura, department.id, dia, periodo)
      return { periodo, total: t.total, confirmado: t.confirmadoEm !== null }
    }),
  }))

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
      <EfetivoLembrete
        departmentId={department.id}
        dateStr={dateStr}
        turnos={turnosLembrete}
        canEdit={editable}
      />
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
      {mostrarTabela && (
        <div data-tour="efet-tabela">
          <EfetivosTable data={rows} canEdit={editable} />
        </div>
      )}
      <EfetivoHistorico
        departmentId={department.id}
        dias={historico}
        esperados={esperados}
        hojeStr={hojeStr}
      />
    </div>
  )
}
