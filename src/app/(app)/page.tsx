import { CheckCircle2, ClipboardList, FileWarning, Users } from "lucide-react"

import { requireUser } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { canEdit, canView } from "@/lib/permissions"
import {
  competenciaLabel,
  currentCompetencia,
  lastCompetencias,
} from "@/lib/competencia"
import {
  JUSTIFICATIVA_CATEGORIAS,
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import { MetricCard } from "@/components/metric-card"
import { PageHeader } from "@/components/layout/page-header"
import { CompetenciaSelect } from "@/components/competencia-select"
import { ChartCard } from "@/components/charts/chart-card"
import { BarChart, type BarChartItem } from "@/components/charts/bar-chart"
import { DonutChart, type DonutChartItem } from "@/components/charts/donut-chart"
import { StackedBar, type StackedBarSegment } from "@/components/charts/stacked-bar"

const OCORRENCIA_ORDER: { key: OcorrenciaTipo; colorClass: string }[] = [
  { key: "FALTA", colorClass: "text-rose-500" },
  { key: "ATRASO", colorClass: "text-amber-500" },
  { key: "SAIDA_ANTECIPADA", colorClass: "text-amber-600" },
  { key: "IMPAR", colorClass: "text-amber-400" },
  { key: "HORA_EXTRA", colorClass: "text-blue-500" },
  { key: "INTERVALO", colorClass: "text-sky-500" },
]

const DOCUMENTO_STATUS = [
  { key: "PENDENTE", label: "Pendente", colorClass: "text-amber-500" },
  { key: "SOLICITADO", label: "Solicitado", colorClass: "text-blue-500" },
  { key: "RECEBIDO", label: "Recebido", colorClass: "text-emerald-500" },
  { key: "CANCELADO", label: "Cancelado", colorClass: "text-zinc-500" },
]

const FECHAMENTO_STATUS = [
  { key: "ABERTO", label: "Aberto", colorClass: "text-amber-500" },
  { key: "EM_ANALISE", label: "Em analise", colorClass: "text-blue-500" },
  { key: "ENCERRADO", label: "Encerrado", colorClass: "text-emerald-500" },
]

const JUSTIFICATIVA_COLORS = [
  "text-emerald-500",
  "text-blue-500",
  "text-amber-500",
  "text-violet-500",
  "text-rose-500",
  "text-zinc-500",
]

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const competencia = params.comp || currentCompetencia()
  const showRH = canView(user.role, "rh")
  const showSensitiveRH = canEdit(user.role, "rh")
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const options = lastCompetencias(12).map((value) => ({
    value,
    label: competenciaLabel(value),
  }))

  const [employeesActive, documentosVencidos, fechs, pendenciasPorStatus, pendenciasVencidas] =
    await Promise.all([
      showRH
        ? prisma.employee.count({ where: { status: "ATIVO" } })
        : Promise.resolve(0),
      showSensitiveRH
        ? prisma.documentoPendencia.count({
            where: {
              status: { in: ["PENDENTE", "SOLICITADO"] },
              followUpDate: { lt: todayUtc },
            },
          })
        : Promise.resolve(0),
      showRH
        ? prisma.espelhoFechamento.findMany({
            where: { competencia },
            select: {
              status: true,
              ocorrencias: {
                select: {
                  tipo: true,
                  resolvido: true,
                  justificativaCategoria: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      showRH
        ? prisma.documentoPendencia.groupBy({
            by: ["status"],
            where: { competencia },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      showRH
        ? prisma.documentoPendencia.count({
            where: {
              competencia,
              status: { in: ["PENDENTE", "SOLICITADO"] },
              followUpDate: { lt: todayUtc },
            },
          })
        : Promise.resolve(0),
    ])

  const ocorrencias = fechs.flatMap((fech) => fech.ocorrencias)
  const totalOcorrencias = ocorrencias.length
  const encerrados = fechs.filter((fech) => fech.status === "ENCERRADO").length

  const ocorrenciaData: BarChartItem[] = OCORRENCIA_ORDER.map((item) => ({
    label: OCORRENCIA_LABEL[item.key],
    value: ocorrencias.filter((ocorrencia) => ocorrencia.tipo === item.key).length,
    colorClass: item.colorClass,
  }))

  const pendenciasByStatus = new Map(
    pendenciasPorStatus.map((item) => [item.status, item._count._all])
  )
  const pendenciasData: DonutChartItem[] = DOCUMENTO_STATUS.map((item) => ({
    label: item.label,
    value: pendenciasByStatus.get(item.key) ?? 0,
    colorClass: item.colorClass,
  })).filter((item) => item.value > 0)

  const fechamentoData: StackedBarSegment[] = FECHAMENTO_STATUS.map((item) => ({
    label: item.label,
    value: fechs.filter((fech) => fech.status === item.key).length,
    colorClass: item.colorClass,
  }))

  const justificativaData: DonutChartItem[] = JUSTIFICATIVA_CATEGORIAS.map(
    (categoria, index) => ({
      label: categoria,
      value: ocorrencias.filter(
        (ocorrencia) =>
          ocorrencia.resolvido &&
          ocorrencia.justificativaCategoria === categoria
      ).length,
      colorClass: JUSTIFICATIVA_COLORS[index % JUSTIFICATIVA_COLORS.length],
    })
  ).filter((item) => item.value > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ola, ${user.name?.split(" ")[0] ?? "bem-vindo"}!`}
        description={`Relatorio mensal de RH - ${competenciaLabel(competencia)}`}
      >
        {showRH && <CompetenciaSelect value={competencia} options={options} />}
      </PageHeader>

      {!showRH ? (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Voce ainda nao tem acesso ao setor de RH. Fale com um administrador.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Colaboradores ativos"
              value={String(employeesActive)}
              icon={Users}
            />
            {showSensitiveRH && (
              <MetricCard
                label="Documentos vencidos"
                value={String(documentosVencidos)}
                hint="Pendencias de todas as competencias"
                icon={FileWarning}
                tone={documentosVencidos > 0 ? "negative" : "default"}
                href="/rh/pendencias?status=overdue&scope=all"
              />
            )}
            <MetricCard
              label="Ocorrencias no mes"
              value={String(totalOcorrencias)}
              icon={ClipboardList}
              tone={totalOcorrencias > 0 ? "negative" : "default"}
            />
            <MetricCard
              label="Espelhos encerrados"
              value={`${encerrados}/${fechs.length}`}
              icon={CheckCircle2}
              tone={fechs.length > 0 && encerrados === fechs.length ? "positive" : "default"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Ocorrencias de ponto por tipo"
              empty={totalOcorrencias === 0}
            >
              <BarChart data={ocorrenciaData} />
            </ChartCard>

            <ChartCard
              title="Pendencias documentais"
              empty={pendenciasData.length === 0}
            >
              <DonutChart
                data={pendenciasData}
                note={`${pendenciasVencidas} vencida(s) na competencia`}
              />
            </ChartCard>

            <ChartCard
              title="Progresso do fechamento"
              empty={fechs.length === 0}
            >
              <StackedBar segments={fechamentoData} />
            </ChartCard>

            <ChartCard
              title="Justificativas por categoria"
              empty={justificativaData.length === 0}
            >
              <DonutChart data={justificativaData} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
