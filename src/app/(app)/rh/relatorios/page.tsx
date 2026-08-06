import Link from "next/link"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDate, formatDateInput, formatDateTime } from "@/lib/format"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DateFilter } from "@/components/date-filter"
import { Badge } from "@/components/ui/badge"

const PERIODOS = ["DIURNO", "NOTURNO"] as const

const RESULTADO_LABEL: Record<string, string> = {
  INTEGRO: "Íntegro",
  ALTERADO: "Texto alterado",
  CODIGO_APENAS: "Só o código",
  NAO_ENCONTRADO: "Não encontrado",
}

// Painel de controle do dia: quais postos fecharam relatório em cada turno e
// quais não fecharam. É a ausência que denuncia quem não está usando o sistema
// — código nenhum mostra quem simplesmente não gerou relatório.
export default async function RelatoriosPainelPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await requireSector("rh")

  const { date } = await searchParams
  const dateStr = date || formatDateInput(new Date())
  const dia = new Date(dateStr)

  const [departments, relatorios, verificacoes] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.relatorioDiario.findMany({
      where: { date: dia },
      select: {
        departmentId: true,
        periodo: true,
        status: true,
        codigo: true,
        responsavel: true,
        finalizadoAt: true,
      },
    }),
    prisma.relatorioVerificacao.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        codigo: true,
        resultado: true,
        actorName: true,
        createdAt: true,
      },
    }),
  ])

  // Só interessam os postos com movimento no dia: listar os 34 postos sempre
  // afogaria o painel em linhas vazias de posto que não opera todo dia.
  const efetivos = await prisma.efetivo.findMany({
    where: { date: dia },
    select: { departmentId: true, periodo: true },
  })

  const comMovimento = new Set([
    ...efetivos.map((e) => e.departmentId),
    ...relatorios.map((r) => r.departmentId),
  ])

  const linhas = departments
    .filter((d) => comMovimento.has(d.id))
    .map((d) => ({
      ...d,
      turnos: PERIODOS.map((periodo) => ({
        periodo,
        // um posto só "deve" relatório no turno em que teve efetivo lançado
        esperado: efetivos.some(
          (e) => e.departmentId === d.id && e.periodo === periodo
        ),
        relatorio: relatorios.find(
          (r) => r.departmentId === d.id && r.periodo === periodo
        ),
      })),
    }))

  const pendentes = linhas.reduce(
    (n, l) =>
      n +
      l.turnos.filter((t) => t.esperado && t.relatorio?.status !== "FINALIZADO")
        .length,
    0
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios de posto"
        description={`Situação em ${formatDate(dia)}.`}
      >
        <ButtonLink variant="outline" href="/rh/relatorios/verificar">
          Verificar relatório
        </ButtonLink>
        <ButtonLink variant="outline" href="/rh/efetivos">
          Efetivos
        </ButtonLink>
        <DateFilter value={dateStr} />
      </PageHeader>

      {linhas.length === 0 ? (
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Nenhum posto com efetivo ou relatório nesta data.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes > 0 && (
            <p className="text-sm">
              <span className="font-medium text-destructive">
                {pendentes} {pendentes === 1 ? "turno" : "turnos"}
              </span>{" "}
              com efetivo lançado e sem relatório finalizado.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left">
                  <th className="px-4 py-3 font-medium">Posto</th>
                  <th className="px-4 py-3 font-medium">Diurno</th>
                  <th className="px-4 py-3 font-medium">Noturno</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {l.name.toUpperCase()}
                    </td>
                    {l.turnos.map((t) => (
                      <td key={t.periodo} className="px-4 py-3">
                        <Link
                          href={`/rh/efetivos/${l.id}/relatorio?date=${dateStr}&periodo=${t.periodo}`}
                          className="inline-flex flex-col gap-1 hover:underline"
                        >
                          <SituacaoBadge
                            esperado={t.esperado}
                            status={t.relatorio?.status}
                          />
                          {t.relatorio?.codigo && (
                            <code className="font-mono text-xs text-muted-foreground">
                              {t.relatorio.codigo}
                            </code>
                          )}
                          {t.relatorio?.responsavel && (
                            <span className="text-xs text-muted-foreground">
                              {t.relatorio.responsavel}
                            </span>
                          )}
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-base font-medium">Últimas verificações</h2>
          <p className="text-sm text-muted-foreground">
            Rastro das conferências de autenticidade. Um mesmo código conferido
            várias vezes em dias diferentes indica relatório reaproveitado.
          </p>
        </div>
        {verificacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma verificação registrada ainda.
          </p>
        ) : (
          <ul className="space-y-1">
            {verificacoes.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs">{v.codigo}</code>
                <Badge
                  variant="secondary"
                  className={
                    v.resultado === "INTEGRO"
                      ? "bg-primary/10 text-primary"
                      : v.resultado === "ALTERADO" ||
                          v.resultado === "NAO_ENCONTRADO"
                        ? "bg-destructive/10 text-destructive"
                        : undefined
                  }
                >
                  {RESULTADO_LABEL[v.resultado] ?? v.resultado}
                </Badge>
                <span className="text-muted-foreground">{v.actorName}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTime(v.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SituacaoBadge({
  esperado,
  status,
}: {
  esperado: boolean
  status?: string
}) {
  if (status === "FINALIZADO") {
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary">
        Finalizado
      </Badge>
    )
  }
  if (status === "RASCUNHO") {
    return <Badge variant="secondary">Rascunho</Badge>
  }
  if (esperado) {
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
        Sem relatório
      </Badge>
    )
  }
  return <span className="text-xs text-muted-foreground">—</span>
}
