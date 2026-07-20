import { Download, Lock } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { competenciaSelectOptions, currentCompetencia } from "@/lib/competencia"
import { formatDate } from "@/lib/format"
import { canEdit } from "@/lib/permissions"
import { getTiposAtivos, getTolerancia } from "@/lib/espelho/config"
import { PageHeader } from "@/components/layout/page-header"
import { CompetenciaSelect } from "@/components/competencia-select"
import { Button } from "@/components/ui/button"
import { FechamentoImport } from "@/components/rh/fechamento-import"
import { ToleranciaInput } from "@/components/rh/tolerancia-input"
import { TiposAtivosManager } from "@/components/rh/tipos-ativos-manager"
import { LimparCompetenciaButton } from "@/components/rh/limpar-competencia-button"
import {
  CompetenciaLockButton,
  EncerrarProntosButton,
  ReprocessarButton,
} from "@/components/rh/competencia-actions"
import { FechamentoBoard } from "@/components/rh/fechamento-board"
import { type FechamentoRow } from "@/components/rh/fechamento-table"

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>
}) {
  const user = await requireSector("rh")
  const editable = canEdit(user.role, "rh")
  const { comp } = await searchParams
  const competencia = comp || currentCompetencia()

  const [fechs, distinct, tolerancia, tiposAtivos, compInfo, lastImport] =
    await Promise.all([
      prisma.espelhoFechamento.findMany({
        where: { competencia },
        include: {
          employee: { select: { name: true } },
          ocorrencias: { select: { resolvido: true, tipo: true } },
        },
      }),
      prisma.espelhoFechamento.groupBy({ by: ["competencia"] }),
      getTolerancia(),
      getTiposAtivos(),
      prisma.espelhoCompetencia.findUnique({ where: { competencia } }),
      prisma.espelhoImportLog.findFirst({
        where: { competencia },
        orderBy: { createdAt: "desc" },
      }),
    ])

  const fechada = compInfo?.status === "FECHADA"

  const options = competenciaSelectOptions(
    distinct.map((d) => d.competencia),
    competencia
  )

  const rows: FechamentoRow[] = fechs
    .map((f) => ({
      id: f.id,
      employee: f.employee.name,
      status: f.status,
      total: f.ocorrencias.length,
      resolved: f.ocorrencias.filter((o) => o.resolvido).length,
      hasFalta: f.ocorrencias.some((o) => o.tipo === "FALTA"),
    }))
    .sort((a, b) => a.employee.localeCompare(b.employee))

  const prontos = fechs.filter(
    (f) => f.status !== "ENCERRADO" && f.ocorrencias.every((o) => o.resolvido)
  ).length
  const encerrados = fechs.filter((f) => f.status === "ENCERRADO").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Encerramento de espelho"
        description="Analise o ponto por competência, justifique as ocorrências e encerre para o RH/folha."
      >
        <CompetenciaSelect value={competencia} options={options} />
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a href={`/rh/fechamento/export?comp=${competencia}`} />
          }
        >
          <Download className="size-4" />
          Exportar Excel
        </Button>
        {editable && (
          <span className="inline-flex items-center gap-2" data-tour="fech-acoes">
            {!fechada && (
              <EncerrarProntosButton
                competencia={competencia}
                prontos={prontos}
              />
            )}
            {fechs.length > 0 && (
              <CompetenciaLockButton
                competencia={competencia}
                fechada={fechada}
              />
            )}
            {!fechada && <LimparCompetenciaButton competencia={competencia} />}
          </span>
        )}
      </PageHeader>

      {fechada && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <Lock className="size-4 shrink-0" />
          <p>
            Competência fechada
            {compInfo?.closedByName && ` por ${compInfo.closedByName}`}
            {compInfo?.closedAt && ` em ${formatDate(compInfo.closedAt)}`}. Importação e
            edição travadas — {encerrados}/{fechs.length} espelho(s) encerrado(s).
          </p>
        </div>
      )}

      {editable && !fechada && (
        <div
          className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
          data-tour="fech-import"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Importar espelho</h2>
            {fechs.length > 0 && <ReprocessarButton competencia={competencia} />}
          </div>
          <ToleranciaInput value={tolerancia} />
          <TiposAtivosManager ativos={[...tiposAtivos]} />
          <FechamentoImport competencia={competencia} />
          {lastImport && (
            <p className="text-sm text-muted-foreground">
              Última importação: {lastImport.fileName} por {lastImport.actorName} em{" "}
              {formatDate(lastImport.createdAt)} · {lastImport.processados}{" "}
              processado(s), {lastImport.ocorrencias} ocorrência(s).
            </p>
          )}
        </div>
      )}

      <div data-tour="fech-board">
        <FechamentoBoard
          data={rows}
          competencia={competencia}
          canEdit={editable && !fechada}
        />
      </div>
    </div>
  )
}
