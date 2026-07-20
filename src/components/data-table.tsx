"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  emptyMessage?: string
  // chave de persistência do estado (default: pathname) — útil se uma rota
  // vier a ter mais de uma DataTable
  stateKey?: string
}

type PersistedState = {
  sorting?: SortingState
  globalFilter?: string
  pageIndex?: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum registro encontrado.",
  stateKey,
}: DataTableProps<TData, TValue>) {
  const pathname = usePathname()
  const storageKey = `dt:${stateKey ?? pathname}`

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Restaura página/busca/ordenação APÓS o mount: o SSR sempre renderiza a
  // página 1 sem filtro, então restaurar no initializer causaria hydration
  // mismatch. queueMicrotask = setState em callback assíncrono (regra lint).
  // O ref impede que o persist rode antes da restauração (StrictMode executa
  // os effects 2x — sem o gate, a 1ª persistência sobrescreveria o snapshot).
  const restoreDone = React.useRef(false)
  React.useEffect(() => {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) {
      restoreDone.current = true
      return
    }
    queueMicrotask(() => {
      try {
        const s = JSON.parse(raw) as PersistedState
        if (Array.isArray(s.sorting)) setSorting(s.sorting)
        if (typeof s.globalFilter === "string") setGlobalFilter(s.globalFilter)
        if (typeof s.pageIndex === "number" && s.pageIndex > 0) {
          setPagination((p) => ({ ...p, pageIndex: s.pageIndex! }))
        }
      } catch {
        // estado corrompido → ignora
      }
      restoreDone.current = true
    })
  }, [storageKey])

  React.useEffect(() => {
    if (!restoreDone.current) return
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        sorting,
        globalFilter,
        pageIndex: pagination.pageIndex,
      } satisfies PersistedState)
    )
  }, [storageKey, sorting, globalFilter, pagination.pageIndex])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    // sem isto, aplicar o filtro restaurado dispararia reset e apagaria o
    // pageIndex restaurado; o reset ao digitar é manual no input abaixo
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  // Clamp: dados/filtro mudaram e a página salva não existe mais
  const pageCount = table.getPageCount()
  React.useEffect(() => {
    if (pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
      queueMicrotask(() => {
        setPagination((p) => ({
          ...p,
          pageIndex: Math.max(0, pageCount - 1),
        }))
      })
    }
  }, [pageCount, pagination.pageIndex])

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={globalFilter}
          onChange={(e) => {
            setGlobalFilter(e.target.value)
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.getCanSort()
                        ? "cursor-pointer select-none"
                        : undefined
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {{ asc: " ↑", desc: " ↓" }[
                      header.column.getIsSorted() as string
                    ] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
