"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { excluirFechamento } from "@/lib/actions/fechamento"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/button-link"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"

export type FechamentoRow = {
  id: string
  employee: string
  status: string
  total: number
  resolved: number
  hasFalta: boolean
}

const STATUS: Record<string, { label: string; className: string }> = {
  ABERTO: {
    label: "Aberto",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  EM_ANALISE: {
    label: "Em análise",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  ENCERRADO: {
    label: "Encerrado",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
}

export function FechamentoTable({
  data,
  competencia,
  canEdit,
}: {
  data: FechamentoRow[]
  competencia: string
  canEdit: boolean
}) {
  const columns: ColumnDef<FechamentoRow>[] = [
    {
      accessorKey: "employee",
      header: "Colaborador",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.employee}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = STATUS[row.original.status] ?? {
          label: row.original.status,
          className: "",
        }
        return (
          <Badge variant="secondary" className={cn(s.className)}>
            {s.label}
          </Badge>
        )
      },
    },
    {
      id: "ocorr",
      header: "Ocorrências",
      enableSorting: false,
      cell: ({ row }) =>
        `${row.original.resolved}/${row.original.total} justificadas`,
    },
    {
      id: "acao",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/rh/fechamento/${row.original.id}?comp=${competencia}`}
          >
            Ver
          </ButtonLink>
          {canEdit && (
            <ConfirmDelete
              onConfirm={async () => {
                const r = await excluirFechamento(row.original.id)
                if (!r.ok) throw new Error()
              }}
              title="Excluir espelho"
              description={`Remover o espelho de ${row.original.employee}? Esta ação não poderá ser desfeita.`}
              successMessage="Espelho excluído."
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar colaborador..."
      emptyMessage="Nenhum espelho importado nesta competência."
    />
  )
}
