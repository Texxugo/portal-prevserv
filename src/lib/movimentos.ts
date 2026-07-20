import { competenciaSelectOptions } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { formatDate } from "@/lib/format"
import type { MatrixRow } from "@/components/rh/movements-matrix"
import type { MovementRow } from "@/components/rh/movements-table"

type Bucket = { count: number; dates: string[] }
const emptyBucket = (): Bucket => ({ count: 0, dates: [] })

const KEY = {
  FALTA: "falta",
  FERIAS: "ferias",
  CONTRATACAO: "contratacao",
  DEMISSAO: "demissao",
} as const

function periodLabel(start: Date, end: Date | null): string {
  return end ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start)
}

export async function getMovimentos(competencia: string) {
  return prisma.movement.findMany({
    where: { competencia },
    orderBy: { startDate: "desc" },
    include: { employee: { select: { name: true } } },
  })
}

export type MovimentoComEmployee = Awaited<
  ReturnType<typeof getMovimentos>
>[number]

// Opções do seletor: competências existentes ∪ a selecionada, desc.
export async function competenciaOptions(selected: string) {
  const distinct = await prisma.movement.groupBy({ by: ["competencia"] })
  return competenciaSelectOptions(
    distinct.map((d) => d.competencia),
    selected
  )
}

export function buildMatrixRows(
  movements: MovimentoComEmployee[]
): MatrixRow[] {
  const agg = new Map<
    string,
    {
      employee: string
      falta: Bucket
      ferias: Bucket
      contratacao: Bucket
      demissao: Bucket
    }
  >()
  for (const m of movements) {
    let row = agg.get(m.employeeId)
    if (!row) {
      row = {
        employee: m.employee.name,
        falta: emptyBucket(),
        ferias: emptyBucket(),
        contratacao: emptyBucket(),
        demissao: emptyBucket(),
      }
      agg.set(m.employeeId, row)
    }
    const key = KEY[m.type as keyof typeof KEY]
    if (!key) continue
    row[key].count += 1
    row[key].dates.push(periodLabel(m.startDate, m.endDate))
  }

  return Array.from(agg.entries())
    .map(([employeeId, a]) => {
      const cell = (b: Bucket) => ({
        count: b.count,
        tooltip: b.dates.join("\n"),
      })
      return {
        employeeId,
        employee: a.employee,
        falta: cell(a.falta),
        ferias: cell(a.ferias),
        contratacao: cell(a.contratacao),
        demissao: cell(a.demissao),
      }
    })
    .sort((x, y) => x.employee.localeCompare(y.employee))
}

export function buildTableRows(
  movements: MovimentoComEmployee[]
): MovementRow[] {
  return movements.map((m) => ({
    id: m.id,
    employee: m.employee.name,
    type: m.type,
    justificada: m.justificada,
    period: periodLabel(m.startDate, m.endDate),
    note: m.note,
  }))
}
