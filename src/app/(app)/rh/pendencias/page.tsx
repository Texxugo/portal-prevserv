import Link from "next/link"
import { AlertTriangle, ListFilter, Settings, type LucideIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { requireSectorEdit } from "@/lib/auth-helpers"
import {
  competenciaLabel,
  competenciaSelectOptions,
  currentCompetencia,
} from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { buildDocumentoMessage } from "@/lib/whatsapp/templates"
import { formatDate, formatDateInput } from "@/lib/format"
import { cn } from "@/lib/utils"
import { OCORRENCIA_LABEL, type OcorrenciaTipo } from "@/lib/espelho/detectar-fechamento"
import { getCobrancaPhone } from "@/lib/notificacoes/config"
import { CobrancaPhoneInput } from "@/components/rh/cobranca-phone-input"
import { ButtonLink } from "@/components/button-link"
import { CompetenciaSelect } from "@/components/competencia-select"
import { PageHeader } from "@/components/layout/page-header"
import { DocumentosTable, type DocumentoRow } from "@/components/rh/documentos-table"
import { DocumentoDetail } from "@/components/rh/documento-detail"
import { DocumentoTiposManager } from "@/components/rh/documento-tipos-manager"
import { NovaPendenciaDialog } from "@/components/rh/nova-pendencia-dialog"

export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{
    comp?: string
    status?: string
    scope?: string
    id?: string
    manage?: string
  }>
}) {
  await requireSectorEdit("rh")
  const params = await searchParams
  const competencia = params.comp || currentCompetencia()

  if (params.manage === "types") {
    const [types, cobrancaPhone] = await Promise.all([
      prisma.documentoTipo.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: { _count: { select: { pendencias: true } } },
      }),
      getCobrancaPhone(),
    ])
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Tipos de documento" description="Configure as categorias disponíveis nas solicitações.">
          <ButtonLink variant="outline" href={`/rh/pendencias?comp=${competencia}`}>Voltar</ButtonLink>
        </PageHeader>
        <DocumentoTiposManager types={types.map((type) => ({
          id: type.id,
          name: type.name,
          active: type.active,
          usageCount: type._count.pendencias,
        }))} />
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium">Notificações de cobrança</h2>
          <p className="text-sm text-muted-foreground">
            WhatsApp que recebe o lembrete diário das pendências com retorno no
            dia (30 min após a entrada do colaborador escalado). Deixe vazio
            para desativar o envio — o sino no topo continua funcionando.
          </p>
          <CobrancaPhoneInput value={cobrancaPhone} />
        </section>
      </div>
    )
  }

  if (params.id) {
    const pending = await prisma.documentoPendencia.findUnique({
      where: { id: params.id },
      include: {
        documentType: { select: { name: true } },
        employee: { select: { phone: true } },
        history: { orderBy: { createdAt: "desc" } },
      },
    })
    if (!pending) notFound()
    const documentTypes = await prisma.documentoTipo.findMany({
      where: { OR: [{ active: true }, { id: pending.documentTypeId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    const sourceLabel = pending.sourceType
      ? `${OCORRENCIA_LABEL[pending.sourceType as OcorrenciaTipo] ?? pending.sourceType}${pending.sourceDate ? ` em ${formatDate(pending.sourceDate)}` : ""}${pending.sourceDetail ? ` — ${pending.sourceDetail}` : ""}`
      : null
    return (
      <div>
        <PageHeader title={pending.employeeName} description={`${pending.documentType.name} · ${competenciaLabel(pending.competencia)}`}>
          <ButtonLink variant="outline" href={`/rh/pendencias?comp=${pending.competencia}`}>Voltar</ButtonLink>
        </PageHeader>
        <DocumentoDetail
          data={{
            id: pending.id,
            employeeName: pending.employeeName,
            matricula: pending.matricula,
            competencia: pending.competencia,
            status: pending.status,
            documentTypeId: pending.documentTypeId,
            reason: pending.reason,
            notes: pending.notes,
            followUpDate: formatDateInput(pending.followUpDate),
            externalUrl: pending.externalUrl,
            sourceLabel,
            phone: pending.employee?.phone ?? null,
          }}
          documentTypes={documentTypes}
          defaultMessage={buildDocumentoMessage({
            employeeName: pending.employeeName,
            documentType: pending.documentType.name,
            competencia: pending.competencia,
            reason: pending.reason,
          })}
          history={pending.history.map((item) => ({
            id: item.id,
            action: item.action,
            description: item.description,
            actorName: item.actorName,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      </div>
    )
  }
  const status = params.status || "open"
  const allCompetencias = params.scope === "all"
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const soonLimit = new Date(todayUtc.getTime() + 2 * 86_400_000)

  const statusWhere =
    status === "open"
      ? { status: { in: ["PENDENTE", "SOLICITADO"] } }
      : status === "overdue"
        ? {
            status: { in: ["PENDENTE", "SOLICITADO"] },
            followUpDate: { lt: todayUtc },
          }
        : status === "all"
          ? {}
          : { status: status.toUpperCase() }

  const scopeWhere = allCompetencias ? {} : { competencia }
  const openStatus = { status: { in: ["PENDENTE", "SOLICITADO"] } }

  const [pendencias, distinct, employees, documentTypes, openPend, counts] =
    await Promise.all([
      prisma.documentoPendencia.findMany({
        where: { ...scopeWhere, ...statusWhere },
        include: { documentType: { select: { name: true } } },
        orderBy: [{ followUpDate: "asc" }, { employeeName: "asc" }],
      }),
      prisma.documentoPendencia.groupBy({ by: ["competencia"] }),
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.documentoTipo.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.documentoPendencia.findMany({
        where: openStatus,
        select: { employeeId: true, documentTypeId: true, competencia: true },
      }),
      Promise.all([
        prisma.documentoPendencia.count({ where: { ...scopeWhere, ...openStatus } }),
        prisma.documentoPendencia.count({
          where: { ...scopeWhere, ...openStatus, followUpDate: { lt: todayUtc } },
        }),
        prisma.documentoPendencia.count({
          where: {
            ...scopeWhere,
            ...openStatus,
            followUpDate: { gte: todayUtc, lte: soonLimit },
          },
        }),
      ]),
    ])

  const [countAberto, countVencidas, countProximas] = counts
  const openKeys = openPend
    .filter((p) => p.employeeId)
    .map((p) => `${p.employeeId}|${p.documentTypeId}|${p.competencia}`)

  const options = competenciaSelectOptions(
    distinct.map((d) => d.competencia),
    competencia
  )

  const rows: DocumentoRow[] = pendencias.map((p) => ({
    id: p.id,
    employee: p.employeeName,
    documentType: p.documentType.name,
    competencia: p.competencia,
    status: p.status,
    followUpDate: p.followUpDate.toISOString(),
    reason: p.reason,
    source: p.sourceType
      ? `${OCORRENCIA_LABEL[p.sourceType as OcorrenciaTipo] ?? p.sourceType}${p.sourceDate ? ` · ${formatDate(p.sourceDate)}` : ""}`
      : null,
    overdue:
      (p.status === "PENDENTE" || p.status === "SOLICITADO") &&
      p.followUpDate < todayUtc,
    soon:
      (p.status === "PENDENTE" || p.status === "SOLICITADO") &&
      p.followUpDate >= todayUtc &&
      p.followUpDate <= soonLimit,
  }))

  const scopeSuffix = allCompetencias ? "&scope=all" : ""
  const link = (nextStatus: string) =>
    `/rh/pendencias?comp=${competencia}&status=${nextStatus}${scopeSuffix}`

  const statusFilters: { key: string; label: string; icon?: LucideIcon }[] = [
    { key: "open", label: "Em aberto" },
    { key: "overdue", label: "Vencidas", icon: AlertTriangle },
    { key: "recebido", label: "Recebidas" },
    { key: "cancelado", label: "Canceladas" },
    { key: "all", label: "Todas" },
  ]

  const counters = [
    { label: "Em aberto", value: countAberto, href: link("open"), tone: "text-blue-600 dark:text-blue-400" },
    { label: "Vencidas", value: countVencidas, href: link("overdue"), tone: "text-destructive" },
    { label: "Próximas (≤2 dias)", value: countProximas, href: link("open"), tone: "text-amber-600 dark:text-amber-400" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendências documentais"
        description="Acompanhe documentos que ainda precisam ser solicitados ou recebidos."
      >
        <CompetenciaSelect value={competencia} options={options} />
        <ButtonLink
          variant="outline"
          href={`/rh/pendencias?comp=${competencia}&status=${status}${allCompetencias ? "" : "&scope=all"}`}
        >
          <ListFilter className="size-4" />
          {allCompetencias ? "Competência atual" : "Todas as competências"}
        </ButtonLink>
        <ButtonLink
          variant="outline"
          href={`/rh/pendencias?comp=${competencia}&manage=types`}
          data-tour="pend-tipos"
        >
          <Settings className="size-4" /> Tipos
        </ButtonLink>
        <span className="inline-flex" data-tour="pend-nova">
          <NovaPendenciaDialog
            employees={employees}
            documentTypes={documentTypes}
            competencia={competencia}
            openKeys={openKeys}
          />
        </span>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3" data-tour="pend-counters">
        {counters.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25"
          >
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold", c.tone)}>{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" data-tour="pend-filtros">
        {statusFilters.map((f) => (
          <ButtonLink
            key={f.key}
            variant={status === f.key ? "default" : "outline"}
            size="sm"
            href={link(f.key)}
          >
            {f.icon && <f.icon className="size-4" />}
            {f.label}
          </ButtonLink>
        ))}
      </div>

      {allCompetencias && (
        <p className="text-sm text-muted-foreground">Exibindo todas as competências.</p>
      )}
      <div data-tour="pend-tabela">
        <DocumentosTable data={rows} />
      </div>
    </div>
  )
}
