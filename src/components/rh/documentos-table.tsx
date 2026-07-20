"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { competenciaLabel } from "@/lib/competencia"
import { DOCUMENTO_STATUS_LABEL, type DocumentoStatus } from "@/lib/documentos"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { DocumentoRowActions } from "@/components/rh/documento-row-actions"

export type DocumentoRow = {
  id: string
  employee: string
  documentType: string
  competencia: string
  status: string
  followUpDate: string
  reason: string
  source: string | null
  overdue: boolean
  soon: boolean
}

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  SOLICITADO: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  RECEBIDO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  CANCELADO: "bg-muted text-muted-foreground",
}

export function DocumentosTable({ data }: { data: DocumentoRow[] }) {
  const columns: ColumnDef<DocumentoRow>[] = [
    {
      accessorKey: "employee",
      header: "Colaborador",
      cell: ({ row }) => (
        <div className="max-w-[280px]">
          <p className="font-medium">{row.original.employee}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.reason}
          </p>
        </div>
      ),
    },
    { accessorKey: "documentType", header: "Documento" },
    {
      accessorKey: "competencia",
      header: "Competência",
      cell: ({ row }) => competenciaLabel(row.original.competencia),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary" className={cn(STATUS_CLASS[row.original.status])}>
          {DOCUMENTO_STATUS_LABEL[row.original.status as DocumentoStatus] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "followUpDate",
      header: "Retorno",
      cell: ({ row }) => (
        <span
          className={cn(
            row.original.overdue && "font-medium text-destructive",
            row.original.soon && !row.original.overdue && "font-medium text-amber-600"
          )}
        >
          {formatDate(row.original.followUpDate)}
          {row.original.overdue ? " · vencida" : row.original.soon ? " · próxima" : ""}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: "Origem",
      cell: ({ row }) => row.original.source ?? "Manual",
    },
    {
      id: "action",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <DocumentoRowActions id={row.original.id} status={row.original.status} />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar colaborador ou documento..."
      emptyMessage="Nenhuma pendência encontrada neste filtro."
    />
  )
}
