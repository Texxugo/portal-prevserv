"use client"

import { Pencil } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { deleteMovement } from "@/lib/actions/movements"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/button-link"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"

export type MovementRow = {
  id: string
  employee: string
  type: string
  justificada: boolean | null
  period: string
  note: string | null
}

const TYPE_META: Record<string, { label: string; className: string }> = {
  FALTA: {
    label: "Falta",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  FERIAS: {
    label: "Férias",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  CONTRATACAO: {
    label: "Contratação",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  DEMISSAO: {
    label: "Demissão",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  },
}

export function MovementsTable({
  data,
  canEdit,
}: {
  data: MovementRow[]
  canEdit: boolean
}) {
  const columns: ColumnDef<MovementRow>[] = [
    {
      accessorKey: "employee",
      header: "Colaborador",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.employee}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const meta = TYPE_META[row.original.type] ?? {
          label: row.original.type,
          className: "",
        }
        return (
          <Badge variant="secondary" className={meta.className}>
            {meta.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "justificada",
      header: "Justificada",
      cell: ({ row }) =>
        row.original.type === "FALTA"
          ? row.original.justificada
            ? "Sim"
            : "Não"
          : "—",
    },
    {
      accessorKey: "period",
      header: "Período",
      cell: ({ row }) => row.original.period,
    },
    {
      accessorKey: "note",
      header: "Observação",
      cell: ({ row }) => row.original.note ?? "—",
    },
  ]

  if (canEdit) {
    columns.push({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ButtonLink
            variant="ghost"
            size="icon-sm"
            aria-label="Editar"
            href={`/rh/movimentos/${row.original.id}`}
          >
            <Pencil className="size-4" />
          </ButtonLink>
          <ConfirmDelete
            onConfirm={async () => {
              await deleteMovement(row.original.id)
            }}
            title="Excluir movimentação"
            description={`Remover esta movimentação de ${row.original.employee}? Esta ação não poderá ser desfeita.`}
            successMessage="Movimentação excluída."
          />
        </div>
      ),
    })
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por colaborador ou tipo..."
      emptyMessage="Nenhuma movimentação registrada."
    />
  )
}
