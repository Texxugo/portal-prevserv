"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"

export type MatrixCell = { count: number; tooltip: string }

export type MatrixRow = {
  employeeId: string
  employee: string
  falta: MatrixCell
  ferias: MatrixCell
  contratacao: MatrixCell
  demissao: MatrixCell
}

function Cell({ cell }: { cell: MatrixCell }) {
  if (cell.count === 0) {
    return <div className="text-center text-muted-foreground">—</div>
  }
  return (
    <div
      className="cursor-help text-center font-medium tabular-nums"
      title={cell.tooltip}
    >
      {cell.count}
    </div>
  )
}

function countColumn(
  id: "falta" | "ferias" | "contratacao" | "demissao",
  label: string
): ColumnDef<MatrixRow> {
  return {
    id,
    header: () => <div className="text-center">{label}</div>,
    accessorFn: (row) => row[id].count,
    enableSorting: false,
    cell: ({ row }) => <Cell cell={row.original[id]} />,
  }
}

const columns: ColumnDef<MatrixRow>[] = [
  {
    accessorKey: "employee",
    header: "Colaborador",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.employee}</span>
    ),
  },
  countColumn("falta", "Falta"),
  countColumn("ferias", "Férias"),
  countColumn("contratacao", "Contratação"),
  countColumn("demissao", "Demissão"),
]

export function MovementsMatrix({ rows }: { rows: MatrixRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Buscar colaborador..."
      emptyMessage="Nenhuma movimentação registrada ainda."
    />
  )
}
