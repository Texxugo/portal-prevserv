import { Download, Lock } from "lucide-react"

import { requireModulo } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { competenciaSelectOptions, currentCompetencia } from "@/lib/competencia"
import { formatDate } from "@/lib/format"
import { podeEditar } from "@/lib/permissions"
import { getTiposAtivos, getTolerancia } from "@/lib/espelho/config"
import {
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import {
  buildDayResolver,
  hasResolverSchedule,
  EMPLOYEE_JORNADA_SELECT,
} from "@/lib/jornada"
import { buildEspelhoMessage } from "@/lib/whatsapp/templates"
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
import {
  OcorrenciasBoard,
  type OcorrenciaCompetenciaRow,
} from "@/components/rh/ocorrencias-board"
import { type FechamentoRow } from "@/components/rh/fechamento-table"
import {
  ImportPendenciasCard,
  type EmployeeOption,
  type PendenciaView,
} from "@/components/rh/import-pendencias-card"
import {
  PontoAcompanhamento,
  type AcompanhamentoRow,
} from "@/components/rh/ponto-acompanhamento"
import { PontoTabs, type PontoAba } from "@/components/rh/ponto-tabs"

// Tela única do ponto eletrônico. Três visões sobre o MESMO dado, cada uma na
// unidade em que aquele trabalho realmente acontece:
//   importar    → sobe o TXT, ajusta a detecção, resolve pendências, avisa o colaborador
//   ocorrencias → justifica; a unidade é a OCORRÊNCIA, e as iguais (mesmo dia,
//                 mesmo tipo) se juntam mesmo vindo de colaboradores diferentes
//   encerrar    → fecha o espelho; aí sim a unidade é o colaborador
// O upload existe só aqui — não há mais uma segunda porta para o mesmo arquivo.
export default async function PontoPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string; aba?: string }>
}) {
  const user = await requireModulo("PONTO")
  const editable = podeEditar(user, "PONTO")
  const { comp, aba } = await searchParams
  const competencia = comp || currentCompetencia()
  // `tratar` era o nome da aba única de justificar+encerrar: continua caindo em
  // "ocorrências" para não quebrar link antigo, tour e favorito de quem usa.
  const abaAtiva: PontoAba =
    aba === "importar"
      ? "importar"
      : aba === "encerrar"
        ? "encerrar"
        : "ocorrencias"

  const [
    fechs,
    distinct,
    tolerancia,
    tiposAtivos,
    compInfo,
    lastImport,
    pendencias,
    employees,
    documentTypes,
  ] = await Promise.all([
    prisma.espelhoFechamento.findMany({
      where: { competencia },
      include: {
        employee: {
          select: {
            ...EMPLOYEE_JORNADA_SELECT,
            phone: true,
            // O posto vira filtro na visão por competência.
            department: { select: { name: true } },
          },
        },
        ocorrencias: { orderBy: { data: "asc" } },
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
    prisma.espelhoImportPendencia.findMany({
      where: { competencia, status: { not: "RESOLVIDA" } },
      orderBy: [{ status: "asc" }, { nome: "asc" }],
    }),
    prisma.employee.findMany({
      where: { status: { not: "INATIVO" } },
      select: { id: true, name: true, matricula: true },
      orderBy: { name: "asc" },
    }),
    prisma.documentoTipo.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
      tipos: [...new Set(f.ocorrencias.map((o) => o.tipo))] as OcorrenciaTipo[],
      tiposPendentes: [
        ...new Set(f.ocorrencias.filter((o) => !o.resolvido).map((o) => o.tipo)),
      ] as OcorrenciaTipo[],
    }))
    .sort((a, b) => a.employee.localeCompare(b.employee))

  // Todas as ocorrências da competência achatadas: é a lista em que o trabalho
  // de justificar realmente acontece, com as iguais lado a lado.
  const ocorrenciaRows: OcorrenciaCompetenciaRow[] = fechs
    .flatMap((f) =>
      f.ocorrencias.map((o) => ({
        id: o.id,
        fechamentoId: f.id,
        dataISO: o.data.toISOString().slice(0, 10),
        data: formatDate(o.data),
        tipo: o.tipo,
        marcacoes: o.marcacoes,
        categoria: o.justificativaCategoria,
        resolvido: o.resolvido,
        employeeName: f.employee.name,
        departmentName: f.employee.department?.name ?? null,
        fechamentoEncerrado: f.status === "ENCERRADO",
      }))
    )
    .sort(
      (a, b) =>
        a.dataISO.localeCompare(b.dataISO) ||
        a.tipo.localeCompare(b.tipo) ||
        a.employeeName.localeCompare(b.employeeName)
    )

  const prontos = fechs.filter(
    (f) => f.status !== "ENCERRADO" && f.ocorrencias.every((o) => o.resolvido)
  ).length
  const encerrados = fechs.filter((f) => f.status === "ENCERRADO").length

  // Acompanhamento: quem ainda tem ocorrência sem justificativa. A mensagem já sai
  // montada do servidor — a tela só permite editar o texto antes de enviar.
  const comPendencia = fechs.filter(
    (f) => f.status !== "ENCERRADO" && f.ocorrencias.some((o) => !o.resolvido)
  )

  const avisos = await prisma.whatsappMessageLog.findMany({
    where: {
      competencia,
      status: "ENVIADO",
      employeeId: { in: comPendencia.map((f) => f.employeeId) },
    },
    orderBy: { createdAt: "desc" },
    select: { employeeId: true, createdAt: true },
  })
  const ultimoAvisoPorEmp = new Map<string, Date>()
  for (const a of avisos) {
    if (a.employeeId && !ultimoAvisoPorEmp.has(a.employeeId)) {
      ultimoAvisoPorEmp.set(a.employeeId, a.createdAt)
    }
  }

  const hoje = new Date()
  const acompanhamento: AcompanhamentoRow[] = comPendencia
    .map((f) => {
      const dias = f.ocorrencias
        .filter((o) => !o.resolvido)
        .map((o) => ({
          data: formatDate(o.data),
          marcacoes: o.marcacoes.split(" ").filter(Boolean),
          tipo: OCORRENCIA_LABEL[o.tipo as keyof typeof OCORRENCIA_LABEL] ?? o.tipo,
          detalhe: o.detalhe,
        }))
      const ultimo = ultimoAvisoPorEmp.get(f.employeeId)
      return {
        fechamentoId: f.id,
        employeeId: f.employeeId,
        nome: f.employee.name,
        matricula: f.employee.matricula,
        phone: f.employee.phone,
        status: f.status,
        dias,
        message: buildEspelhoMessage({
          nome: f.employee.name,
          competencia,
          dias,
        }),
        onDutyToday: hasResolverSchedule(f.employee)
          ? buildDayResolver(f.employee)(hoje) !== null
          : null,
        ultimoAviso: ultimo ? formatDate(ultimo) : null,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const pendenciaRows: PendenciaView[] = pendencias.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    nome: p.nome,
    matricula: p.matricula,
    empresa: p.empresa,
    employeeId: p.employeeId,
    diasCount: p.diasCount,
    status: p.status,
    motivo: p.motivo,
    fileName: p.fileName,
  }))

  const employeeOptions: EmployeeOption[] = employees.map((e) => ({
    value: e.id,
    label: e.name,
    matricula: e.matricula,
  }))

  const pendenciasAbertas = pendencias.filter((p) => p.status === "ABERTA").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ponto eletrônico"
        description="Importe o arquivo do Qyon, acompanhe as ocorrências do período e encerre a competência para a folha."
      >
        <CompetenciaSelect value={competencia} options={options} />
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/rh/ponto/export?comp=${competencia}`} />}
        >
          <Download className="size-4" />
          Exportar Excel
        </Button>
        {editable && (
          <span className="inline-flex items-center gap-2" data-tour="ponto-acoes">
            {!fechada && (
              <EncerrarProntosButton competencia={competencia} prontos={prontos} />
            )}
            {fechs.length > 0 && (
              <CompetenciaLockButton competencia={competencia} fechada={fechada} />
            )}
            {!fechada && <LimparCompetenciaButton competencia={competencia} />}
          </span>
        )}
      </PageHeader>

      <PontoTabs
        aba={abaAtiva}
        competencia={competencia}
        badgeImportar={pendenciasAbertas}
        badgeOcorrencias={ocorrenciaRows.filter((o) => !o.resolvido).length}
        badgeEncerrar={
          fechs.filter((f) => f.status !== "ENCERRADO").length
        }
      />

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

      {abaAtiva === "importar" ? (
        <>
          {editable && !fechada && (
            <div
              className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
              data-tour="ponto-import"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Importar arquivo do Qyon</h2>
                {fechs.length > 0 && (
                  <ReprocessarButton competencia={competencia} />
                )}
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

          <ImportPendenciasCard
            pendencias={pendenciaRows}
            employees={employeeOptions}
            canEdit={editable && !fechada}
          />

          <div data-tour="ponto-acompanhamento">
            <PontoAcompanhamento
              rows={acompanhamento}
              competencia={competencia}
              documentTypes={documentTypes}
              canEdit={editable && !fechada}
            />
          </div>
        </>
      ) : abaAtiva === "ocorrencias" ? (
        <div data-tour="ponto-ocorrencias">
          <OcorrenciasBoard
            rows={ocorrenciaRows}
            competencia={competencia}
            canEdit={editable && !fechada}
          />
        </div>
      ) : (
        <div data-tour="ponto-board">
          <FechamentoBoard
            data={rows}
            competencia={competencia}
            canEdit={editable && !fechada}
          />
        </div>
      )}
    </div>
  )
}
