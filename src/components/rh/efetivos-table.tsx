"use client"

import { Pencil } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { deleteEfetivo } from "@/lib/actions/efetivos"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/button-link"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"

export type EfetivoRow = {
  id: string
  departmentId: string
  pessoa: string
  freelancer: boolean
  horario: string | null
  local: string | null
  evento: string | null
  periodo: string
  extra: boolean
  // status da pendência de documento mais recente (null = sem registro)
  documentoStatus: string | null
}

const PERIODO_META: Record<string, { label: string; className: string }> = {
  DIURNO: {
    label: "Diurno",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  NOTURNO: {
    label: "Noturno",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  },
}

const DOCUMENTO_META: Record<string, { label: string; className: string }> = {
  RECEBIDO: {
    label: "OK",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  PENDENTE: {
    label: "Pendente",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  SOLICITADO: {
    label: "Solicitado",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  CANCELADO: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
}

function displayEvento(evento: string | null) {
  return evento === "AS TE" ? "TE" : evento
}

export function EfetivosTable({
  data,
  canEdit,
}: {
  data: EfetivoRow[]
  canEdit: boolean
}) {
  const columns: ColumnDef<EfetivoRow>[] = [
    {
      accessorKey: "pessoa",
      header: "Funcionário",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.original.pessoa}</span>
          {row.original.freelancer && (
            <Badge
              variant="secondary"
              className="bg-violet-500/15 text-violet-700 dark:text-violet-400"
            >
              Freelancer
            </Badge>
          )}
        </span>
      ),
    },
    {
      accessorKey: "horario",
      header: "Horário",
      cell: ({ row }) => row.original.horario ?? "—",
    },
    {
      accessorKey: "local",
      header: "Local",
      cell: ({ row }) => row.original.local ?? "—",
    },
    {
      accessorKey: "evento",
      header: "Evento",
      cell: ({ row }) => {
        const evento = displayEvento(row.original.evento)
        return evento ? (
          <Badge variant="secondary">{evento}</Badge>
        ) : (
          "—"
        )
      },
    },
    {
      accessorKey: "periodo",
      header: "Período",
      cell: ({ row }) => {
        const meta = PERIODO_META[row.original.periodo] ?? {
          label: row.original.periodo,
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
      accessorKey: "extra",
      header: "Extra",
      cell: ({ row }) =>
        row.original.extra ? (
          <Badge
            variant="secondary"
            className="bg-rose-500/15 text-rose-700 dark:text-rose-400"
          >
            Extra
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "documentoStatus",
      header: "Documento",
      cell: ({ row }) => {
        const status = row.original.documentoStatus
        if (!status) return "—"
        const meta = DOCUMENTO_META[status] ?? { label: status, className: "" }
        return (
          <Badge variant="secondary" className={meta.className}>
            {meta.label}
          </Badge>
        )
      },
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
            href={`/rh/efetivos/${row.original.departmentId}/${row.original.id}`}
          >
            <Pencil className="size-4" />
          </ButtonLink>
          <ConfirmDelete
            onConfirm={async () => {
              await deleteEfetivo(row.original.id)
            }}
            title="Excluir efetivo"
            description={`Remover este registro de ${row.original.pessoa}? Esta ação não poderá ser desfeita.`}
            successMessage="Efetivo excluído."
          />
        </div>
      ),
    })
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por funcionário, local ou evento..."
      emptyMessage="Nenhum efetivo registrado nesta data."
    />
  )
}
