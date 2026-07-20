"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createDocumentoPendencia } from "@/lib/actions/documentos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Option = { id: string; name: string }

function defaultFollowUp(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString().slice(0, 10)
}

export function DocumentoForm({
  employees,
  documentTypes,
  defaults,
  openKeys,
  onCreated,
}: {
  employees: Option[]
  documentTypes: Option[]
  defaults: {
    employeeId: string
    competencia: string
    occurrenceId?: string | null
    reason?: string
    origin?: string | null
  }
  openKeys?: string[]
  onCreated?: (id: string) => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [employeeId, setEmployeeId] = useState(defaults.employeeId)
  const [competencia, setCompetencia] = useState(defaults.competencia)
  const [documentTypeId, setDocumentTypeId] = useState("")
  const [reason, setReason] = useState(defaults.reason ?? "")
  const [notes, setNotes] = useState("")
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUp)
  const [alreadyRequested, setAlreadyRequested] = useState(false)
  const locked = !!defaults.occurrenceId

  const isDuplicate =
    !locked &&
    !!employeeId &&
    !!documentTypeId &&
    (openKeys?.includes(`${employeeId}|${documentTypeId}|${competencia}`) ?? false)

  const employeeItems = Object.fromEntries(employees.map((e) => [e.id, e.name]))
  const typeItems = Object.fromEntries(documentTypes.map((t) => [t.id, t.name]))

  function submit() {
    start(async () => {
      const result = await createDocumentoPendencia({
        employeeId,
        competencia,
        documentTypeId,
        occurrenceId: defaults.occurrenceId,
        reason,
        notes,
        followUpDate,
        alreadyRequested: locked ? false : alreadyRequested,
      })
      if (!result.ok || !result.id) {
        toast.error(result.error || "Não foi possível criar a pendência.")
        return
      }
      toast.success("Pendência documental criada.")
      if (onCreated) {
        onCreated(result.id)
      } else {
        router.push(`/rh/pendencias?comp=${competencia}&id=${result.id}`)
      }
    })
  }

  return (
    <div className="space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      {defaults.origin && (
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <span className="font-medium">Origem:</span> {defaults.origin}
        </div>
      )}
      {!locked && (
        <div className="space-y-2">
          <Label>Situação da solicitação</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={alreadyRequested ? "outline" : "default"}
              size="sm"
              onClick={() => setAlreadyRequested(false)}
            >
              Ainda vou solicitar
            </Button>
            <Button
              type="button"
              variant={alreadyRequested ? "default" : "outline"}
              size="sm"
              onClick={() => setAlreadyRequested(true)}
            >
              Já foi solicitada
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {alreadyRequested
              ? "Registra como já solicitada (sem enviar mensagem)."
              : "A pendência fica aguardando solicitação."}
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Colaborador *</Label>
          <Select
            value={employeeId}
            onValueChange={(v) => setEmployeeId(v ?? "")}
            items={employeeItems}
            disabled={locked}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="competencia-documento">Competência *</Label>
          <Input
            id="competencia-documento"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de documento *</Label>
          <Select value={documentTypeId} onValueChange={(v) => setDocumentTypeId(v ?? "")} items={typeItems}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {documentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="reason">Motivo</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="follow-up">Cobrar novamente em *</Label>
          <Input id="follow-up" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </div>
      </div>
      {isDuplicate && (
        <div className="rounded-lg bg-amber-500/15 p-3 text-sm text-amber-700 dark:text-amber-400">
          Já existe uma pendência aberta deste tipo para este colaborador nesta competência.
        </div>
      )}
      <Button
        onClick={submit}
        disabled={pending || isDuplicate || !employeeId || !competencia || !documentTypeId || !followUpDate}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {alreadyRequested ? "Registrar pendência" : "Criar pendência"}
      </Button>
    </div>
  )
}
