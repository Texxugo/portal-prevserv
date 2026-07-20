"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
} from "lucide-react"

import type { ImportState } from "@/lib/actions/import"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/button-link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ImportAction = (
  state: ImportState,
  formData: FormData
) => Promise<ImportState>

function SubmitButton({
  value,
  children,
  variant,
}: {
  value: string
  children: React.ReactNode
  variant?: "default" | "outline"
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      name="confirm"
      value={value}
      variant={variant}
      disabled={pending}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  )
}

export function ImportPanel({
  action,
  columns,
  templateName,
  templateHeaders,
  templateExample,
  backHref,
  backLabel,
}: {
  action: ImportAction
  columns: { key: string; label: string }[]
  templateName: string
  templateHeaders: string[]
  templateExample: string[]
  backHref: string
  backLabel: string
}) {
  const [state, formAction] = useActionState<ImportState, FormData>(
    action,
    undefined
  )

  function downloadTemplate() {
    const csv = [templateHeaders.join(","), templateExample.join(",")].join("\n")
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = templateName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <form
        action={formAction}
        className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
      >
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo (.xlsx ou .csv)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
          />
          <p className="text-sm text-muted-foreground">
            A primeira linha deve conter os cabeçalhos. Baixe o modelo para
            garantir as colunas corretas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton value="0" variant="default">
            <Upload className="size-4" />
            Pré-visualizar
          </SubmitButton>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" />
            Baixar modelo
          </Button>
          {state?.status === "preview" && (state.validCount ?? 0) > 0 && (
            <SubmitButton value="1" variant="default">
              <CheckCircle2 className="size-4" />
              Confirmar importação ({state.validCount})
            </SubmitButton>
          )}
        </div>
      </form>

      {state?.status === "error" && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {state.message}
        </div>
      )}

      {state?.status === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            {state.insertedCount} registro(s) importado(s) com sucesso.
            {(state.errorCount ?? 0) > 0 &&
              ` ${state.errorCount} linha(s) ignorada(s) por erros.`}
          </div>
          <ButtonLink href={backHref}>{backLabel}</ButtonLink>
        </div>
      )}

      {state?.status === "preview" && state.rows && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400">
              {state.validCount} válida(s)
            </span>
            <span className="text-destructive">
              {state.errorCount} com erro
            </span>
          </div>

          {(state.validCount ?? 0) === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              Nenhuma linha válida para importar. Corrija os erros e tente
              novamente.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Linha</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                  <TableHead>Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.rows.map((row) => (
                  <TableRow
                    key={row.line}
                    className={cn(row.errors.length > 0 && "bg-destructive/5")}
                  >
                    <TableCell className="text-muted-foreground">
                      {row.line}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        {row.cells[c.key] || "—"}
                      </TableCell>
                    ))}
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <span className="text-sm text-destructive">
                          {row.errors.join("; ")}
                        </span>
                      ) : (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
