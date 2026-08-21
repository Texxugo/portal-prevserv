import Link from "next/link"
import { Building2 } from "lucide-react"

import { requireModulo } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import {
  EFETIVO_JANELAS,
  estadoDoTurno,
  inicioDaJanela,
  PERIODO_LABEL,
} from "@/lib/efetivo-cobertura"
import {
  carregarCobertura,
  carregarTurnosEsperados,
  turnoDe,
} from "@/lib/efetivo-cobertura-db"
import { formatDateInput } from "@/lib/format"
import { filtroPostoId, verTodosPostos } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"

export default async function EfetivosPage() {
  const access = await requireModulo("EFETIVOS")

  const agora = new Date()
  const hojeStr = formatDateInput(agora)

  const [departments, cobertura, esperadosPorPosto] = await Promise.all([
    prisma.department.findMany({
      where: filtroPostoId(access),
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { efetivos: true } } },
    }),
    carregarCobertura([hojeStr]),
    carregarTurnosEsperados(hojeStr),
  ])

  // Situação de hoje por posto: a grade vira a lista de conferência do turno e
  // vai esvaziando conforme cada posto confirma ou atualiza o efetivo.
  const cards = departments.map((d) => {
    const esperados = esperadosPorPosto.get(d.id) ?? []
    const pendencias = EFETIVO_JANELAS.map((janela) => {
      const turno = turnoDe(cobertura, d.id, hojeStr, janela.periodo)
      return {
        periodo: janela.periodo,
        estado: estadoDoTurno({
          total: turno.total,
          atualizadoEm: turno.atualizadoEm,
          confirmadoEm: turno.confirmadoEm,
          inicioJanela: inicioDaJanela(hojeStr, janela.hora),
          agora,
        }),
      }
    }).filter(
      (p) =>
        p.estado === "PENDENTE" ||
        // ausência só vira alerta no turno que o posto costuma registrar
        (p.estado === "SEM_CADASTRO" && esperados.includes(p.periodo))
    )
    return { ...d, pendencias }
  })

  const postosPendentes = cards.filter((c) => c.pendencias.length > 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Efetivos"
        description="Escolha o posto para consultar e cadastrar os efetivos do dia."
      >
        <ButtonLink variant="outline" href="/rh/efetivos/ausencias">
          Ausências de cadastro
        </ButtonLink>
      </PageHeader>

      {postosPendentes > 0 && (
        <p className="text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {postosPendentes} {postosPendentes === 1 ? "posto" : "postos"}
          </span>{" "}
          com turno de hoje a conferir. O lembrete abre às 07:00 e às 17:00.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {verTodosPostos(access)
              ? "Nenhum posto cadastrado. Cadastre os postos em Departamentos."
              : "Nenhum posto ligado ao seu acesso. Peça a um administrador para vincular o seu posto."}
          </p>
        ) : (
          cards.map((d) => (
            <Link
              key={d.id}
              href={`/rh/efetivos/${d.id}`}
              data-tour="efetivos-card"
              className="flex items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium uppercase">
                  {d.name}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {d._count.efetivos === 1
                    ? "1 efetivo registrado"
                    : `${d._count.efetivos} efetivos registrados`}
                </span>
                {d.pendencias.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {d.pendencias.map((p) => (
                      <Badge
                        key={p.periodo}
                        variant={
                          p.estado === "SEM_CADASTRO"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {PERIODO_LABEL[p.periodo] ?? p.periodo}:{" "}
                        {p.estado === "SEM_CADASTRO"
                          ? "sem cadastro"
                          : "conferir"}
                      </Badge>
                    ))}
                  </span>
                )}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
