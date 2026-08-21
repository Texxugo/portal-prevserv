import { notFound } from "next/navigation"

import { requirePosto } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDate, formatDateInput } from "@/lib/format"
import { podeEditar } from "@/lib/permissions"
import {
  buildRelatorioDiarioMessage,
  comRodapeAutenticidade,
} from "@/lib/whatsapp/templates"
import { PageHeader } from "@/components/layout/page-header"
import { ButtonLink } from "@/components/button-link"
import { DateFilter } from "@/components/date-filter"
import {
  RelatorioForm,
  type RelatorioValues,
} from "@/components/rh/relatorio-form"

const PERIODOS = [
  { value: "DIURNO", label: "Diurno" },
  { value: "NOTURNO", label: "Noturno" },
]

export default async function RelatorioDiarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ deptId: string }>
  searchParams: Promise<{ date?: string; periodo?: string }>
}) {
  const { deptId } = await params
  const user = await requirePosto("RELATORIOS", deptId)
  const editable = podeEditar(user, "RELATORIOS")

  const { date, periodo } = await searchParams
  const dateStr = date || formatDateInput(new Date())
  const periodoStr = periodo === "NOTURNO" ? "NOTURNO" : "DIURNO"

  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: { id: true, name: true, whatsappGrupoId: true },
  })
  if (!department) notFound()

  const [modelo, relatorio] = await Promise.all([
    prisma.relatorioModeloItem.findMany({
      where: { departmentId: department.id, ativo: true },
      orderBy: { ordem: "asc" },
      select: { secao: true, label: true },
    }),
    prisma.relatorioDiario.findUnique({
      where: {
        departmentId_date_periodo: {
          departmentId: department.id,
          date: new Date(dateStr),
          periodo: periodoStr,
        },
      },
      include: {
        veiculos: { orderBy: { ordem: "asc" } },
        encomendas: { orderBy: { ordem: "asc" } },
        itens: { orderBy: { ordem: "asc" } },
        vistorias: { orderBy: { ordem: "asc" } },
      },
    }),
  ])

  const values: RelatorioValues | null = relatorio
    ? {
        id: relatorio.id,
        status: relatorio.status,
        codigo: relatorio.codigo,
        finalizadoAt: relatorio.finalizadoAt,
        finalizadoPorNome: relatorio.finalizadoPorNome,
        enviadoAt: relatorio.enviadoAt,
        enviadoErro: relatorio.enviadoErro,
        responsavel: relatorio.responsavel,
        encomendasProxTurno: relatorio.encomendasProxTurno,
        horaEncerramento: relatorio.horaEncerramento,
        postoPassadoPara: relatorio.postoPassadoPara,
        observacoes: relatorio.observacoes,
        mensagem: relatorio.mensagem,
        veiculos: relatorio.veiculos.map((v) => ({
          identificacao: v.identificacao,
          placa: v.placa,
          kmInicial: v.kmInicial,
          kmFinal: v.kmFinal,
          kmProximaTroca: v.kmProximaTroca,
        })),
        encomendas: relatorio.encomendas.map((e) => ({
          destinatario: e.destinatario,
          quadraLote: e.quadraLote,
          codigos: e.codigos,
        })),
        itens: relatorio.itens.map((i) => ({
          secao: i.secao,
          label: i.label,
          valor: i.valor,
          status: i.status,
          observacao: i.observacao,
        })),
        vistorias: relatorio.vistorias.map((v) => ({
          tipo: v.tipo,
          titulo: v.titulo,
          quadraLote: v.quadraLote,
          endereco: v.endereco,
          proprietario: v.proprietario,
          responsavel: v.responsavel,
          situacao: v.situacao,
          apontamentos: v.apontamentos,
          observacao: v.observacao,
        })),
      }
    : null

  // O relatório pode ter itens que não estão mais na lista do posto (a lista foi
  // editada depois). Eles continuam aparecendo, para o relatório não perder o
  // que já foi preenchido.
  const doModelo = new Set(modelo.map((m) => `${m.secao}|${m.label}`))
  const modeloCompleto = [
    ...modelo,
    ...(values?.itens ?? [])
      .filter((i) => !doModelo.has(`${i.secao}|${i.label}`))
      .map((i) => ({ secao: i.secao, label: i.label })),
  ]

  const header = (
    <PageHeader
      title={`Relatório diário — ${department.name.toUpperCase()}`}
      description={`${formatDate(new Date(dateStr))} · turno ${periodoStr.toLowerCase()}.`}
    >
      <ButtonLink variant="outline" href={`/rh/efetivos/${department.id}`}>
        Voltar ao posto
      </ButtonLink>
      <ButtonLink variant="outline" href="/rh/relatorios/verificar">
        Verificar código
      </ButtonLink>
      <DateFilter value={dateStr} />
      {PERIODOS.map((p) => (
        <ButtonLink
          key={p.value}
          variant={p.value === periodoStr ? "default" : "outline"}
          href={`/rh/efetivos/${department.id}/relatorio?date=${dateStr}&periodo=${p.value}`}
        >
          {p.label}
        </ButtonLink>
      ))}
    </PageHeader>
  )

  // Gestor tem acesso de leitura no setor: vê o relatório pronto, não o formulário.
  if (!editable) {
    const corpo =
      values?.mensagem ??
      (values
        ? buildRelatorioDiarioMessage({
            posto: department.name,
            date: new Date(dateStr),
            periodo: periodoStr,
            responsavel: values.responsavel,
            encomendasProxTurno: values.encomendasProxTurno,
            horaEncerramento: values.horaEncerramento,
            postoPassadoPara: values.postoPassadoPara,
            observacoes: values.observacoes,
            veiculos: values.veiculos.map((v) => ({
              ...v,
              kmRodado:
                v.kmInicial !== null && v.kmFinal !== null
                  ? v.kmFinal - v.kmInicial
                  : null,
            })),
            encomendas: values.encomendas,
            estatisticas: values.itens.filter((i) => i.secao === "ESTATISTICA"),
            portaria: values.itens.filter((i) => i.secao === "PORTARIA"),
            vistorias: values.vistorias,
          })
        : null)

    const texto = corpo ? comRodapeAutenticidade(corpo, values?.codigo ?? null) : null

    return (
      <div>
        {header}
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          {texto ? (
            <pre className="whitespace-pre-wrap font-mono text-sm">{texto}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum relatório preenchido para esta data e turno.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <RelatorioForm
        departmentId={department.id}
        departmentName={department.name}
        date={dateStr}
        periodo={periodoStr}
        modelo={modeloCompleto}
        relatorio={values}
        temGrupo={!!department.whatsappGrupoId}
      />
    </div>
  )
}
