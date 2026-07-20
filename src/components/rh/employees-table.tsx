"use client"

import { Pencil } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { deleteEmployee } from "@/lib/actions/rh"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/button-link"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"
import { OnDutyBadge } from "@/components/rh/on-duty-badge"

export type EmployeeRow = {
  id: string
  name: string
  cpf: string | null
  email: string | null
  phone: string | null
  position: string | null
  department: string | null
  status: string
  salary: number | null
  onDutyToday: boolean | null
}

const STATUS: Record<string, { label: string; className: string }> = {
  ATIVO: {
    label: "Ativo",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  AFASTADO: {
    label: "Afastado",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  INATIVO: {
    label: "Inativo",
    className: "bg-muted text-muted-foreground",
  },
}

export function EmployeesTable({
  data,
  canEdit,
  canViewSalary,
}: {
  data: EmployeeRow[]
  canEdit: boolean
  canViewSalary: boolean
}) {
  const columns: ColumnDef<EmployeeRow>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          <OnDutyBadge onDuty={row.original.onDutyToday} />
        </div>
      ),
    },
    {
      accessorKey: "position",
      header: "Cargo",
      cell: ({ row }) => row.original.position ?? "—",
    },
    {
      accessorKey: "department",
      header: "Departamento",
      cell: ({ row }) => row.original.department ?? "—",
    },
    {
      accessorKey: "phone",
      header: "Ramal",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      accessorKey: "status",
      header: "Situação",
      cell: ({ row }) => {
        const s = STATUS[row.original.status] ?? {
          label: row.original.status,
          className: "",
        }
        return (
          <Badge variant="secondary" className={s.className}>
            {s.label}
          </Badge>
        )
      },
    },
  ]

  if (canViewSalary) {
    columns.push({
      accessorKey: "salary",
      header: "Salário",
      cell: ({ row }) =>
        row.original.salary != null ? formatCurrency(row.original.salary) : "—",
    })
  }

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
            href={`/rh/${row.original.id}`}
          >
            <Pencil className="size-4" />
          </ButtonLink>
          <ConfirmDelete
            onConfirm={async () => {
              await deleteEmployee(row.original.id)
            }}
            title="Excluir colaborador"
            description={`Remover ${row.original.name}? Esta ação não poderá ser desfeita.`}
            successMessage="Colaborador excluído."
          />
        </div>
      ),
    })
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar colaborador..."
      emptyMessage="Nenhum colaborador cadastrado."
    />
  )
}
