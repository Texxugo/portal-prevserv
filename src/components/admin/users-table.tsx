"use client"

import { Pencil } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Role } from "@prisma/client"

import { deleteUser } from "@/lib/actions/users"
import { ROLE_LABELS } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/button-link"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"

export type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
}

export function UsersTable({
  data,
  currentUserId,
}: {
  data: UserRow[]
  currentUserId: string
}) {
  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "E-mail",
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: "role",
      header: "Perfil",
      cell: ({ row }) => (
        <Badge variant="secondary">{ROLE_LABELS[row.original.role]}</Badge>
      ),
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={cn(
            row.original.active
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {row.original.active ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ButtonLink
            variant="ghost"
            size="icon-sm"
            aria-label="Editar"
            href={`/admin/usuarios/${row.original.id}`}
          >
            <Pencil className="size-4" />
          </ButtonLink>
          {row.original.id !== currentUserId && (
            <ConfirmDelete
              onConfirm={async () => {
                await deleteUser(row.original.id)
              }}
              title="Excluir usuário"
              description={`Excluir ${row.original.name}? Esta ação não poderá ser desfeita.`}
              successMessage="Usuário excluído."
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
      searchPlaceholder="Buscar usuário..."
      emptyMessage="Nenhum usuário cadastrado."
    />
  )
}
