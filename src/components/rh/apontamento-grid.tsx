"use client"

import { useMemo, useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Loader2, Save, Search } from "lucide-react"
import { toast } from "sonner"

import { salvarApontamento, type ApontamentoInput } from "@/lib/actions/apontamento"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// Valores editáveis na grade (números como string p/ permitir vazio).
export type FieldValues = {
  total: string
  valeTransporte: string
  valeRefeicao: string
  adicionalNoturno: string
  he50: string
  he100: string
  intra: string
  faltasE: string
  faltasF: string
  faltasJust: string
  faltasNJust: string
  dsr: string
  gratPercent: string
  recebeCesta: boolean
  recebeAssiduidade: boolean
  observacoes: string
}

export type ApontamentoRow = {
  employeeId: string
  nome: string
  matricula: string | null
  values: FieldValues
}

const PAGE_SIZE = 25

const NUM_FIELDS: { key: keyof FieldValues; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "valeTransporte", label: "Vale transporte" },
  { key: "valeRefeicao", label: "Vale refeição" },
  { key: "adicionalNoturno", label: "Adic. noturno" },
  { key: "intra", label: "Intra" },
  { key: "faltasE", label: "Faltas (E)" },
  { key: "faltasF", label: "Faltas (F)" },
  { key: "faltasJust", label: "Faltas just." },
  { key: "faltasNJust", label: "Faltas n/ just." },
  { key: "dsr", label: "DSR" },
  { key: "gratPercent", label: "Grat. (%)" },
]

const num = (s: string): number | null => {
  const t = s.trim()
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}
const baseNum = (s: string): number => num(s) ?? 0

function toInput(
  employeeId: string,
  competencia: string,
  v: FieldValues
): ApontamentoInput {
  return {
    employeeId,
    competencia,
    total: baseNum(v.total),
    valeTransporte: baseNum(v.valeTransporte),
    valeRefeicao: baseNum(v.valeRefeicao),
    adicionalNoturno: num(v.adicionalNoturno),
    he50: v.he50.trim() || null,
    he100: v.he100.trim() || null,
    intra: num(v.intra),
    faltasE: num(v.faltasE),
    faltasF: num(v.faltasF),
    faltasJust: num(v.faltasJust),
    faltasNJust: num(v.faltasNJust),
    dsr: num(v.dsr),
    gratPercent: num(v.gratPercent),
    recebeCesta: v.recebeCesta,
    recebeAssiduidade: v.recebeAssiduidade,
    observacoes: v.observacoes.trim() || null,
  }
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        inputMode={placeholder ? "text" : "numeric"}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}

function EmployeeCard({
  row,
  competencia,
  value,
  onChange,
}: {
  row: ApontamentoRow
  competencia: string
  value: FieldValues
  onChange: (patch: Partial<FieldValues>) => void
}) {
  const [saving, start] = useTransition()
  const faltasTotal = (num(value.faltasE) ?? 0) + (num(value.faltasF) ?? 0)

  function save() {
    start(async () => {
      const r = await salvarApontamento(toInput(row.employeeId, competencia, value))
      if (r.ok) toast.success(`Apontamento de ${row.nome} salvo.`)
      else toast.error(r.error || "Não foi possível salvar.")
    })
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{row.nome}</p>
          <p className="text-sm text-muted-foreground">
            Matrícula {row.matricula || "—"}
            {faltasTotal > 0 && ` · Faltas total: ${faltasTotal}`}
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {NUM_FIELDS.map((f) => (
          <NumField
            key={f.key}
            label={f.label}
            value={value[f.key] as string}
            onChange={(v) => onChange({ [f.key]: v })}
          />
        ))}
        <NumField
          label="HE 50%"
          value={value.he50}
          onChange={(v) => onChange({ he50: v })}
          placeholder="HH:MM"
        />
        <NumField
          label="HE 100%"
          value={value.he100}
          onChange={(v) => onChange({ he100: v })}
          placeholder="HH:MM"
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <Checkbox
          checked={value.recebeCesta}
          onChange={(v) => onChange({ recebeCesta: v })}
          label="Recebe premiação de cesta"
        />
        <Checkbox
          checked={value.recebeAssiduidade}
          onChange={(v) => onChange({ recebeAssiduidade: v })}
          label="Recebe premiação de assiduidade"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Observações (uma por linha — adicionais, suspensão, descontos…)
        </Label>
        <Textarea
          value={value.observacoes}
          onChange={(e) => onChange({ observacoes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  )
}

export function ApontamentoGrid({
  competencia,
  rows,
}: {
  competencia: string
  rows: ApontamentoRow[]
}) {
  const [values, setValues] = useState<Record<string, FieldValues>>(() =>
    Object.fromEntries(rows.map((r) => [r.employeeId, r.values]))
  )
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        (r.matricula ?? "").toLowerCase().includes(q)
    )
  }, [rows, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} colaborador(es)</p>
        <div className="relative max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome ou matrícula..."
            className="pl-8"
          />
        </div>
      </div>

      {pageRows.map((r) => (
        <EmployeeCard
          key={r.employeeId}
          row={r}
          competencia={competencia}
          value={values[r.employeeId]}
          onChange={(patch) =>
            setValues((prev) => ({
              ...prev,
              [r.employeeId]: { ...prev[r.employeeId], ...patch },
            }))
          }
        />
      ))}

      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-muted-foreground">
            Página {current + 1} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
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
