"use server"

import { requireSector, requireSectorEdit } from "@/lib/auth-helpers"
import { competenciaRange } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { buildEmployeeIndex } from "@/lib/employee-match"
import { formatDate } from "@/lib/format"
import {
  detectarOcorrencias,
  OCORRENCIA_LABEL,
} from "@/lib/espelho/detectar-fechamento"
import { diasComOcorrencia } from "@/lib/espelho/detectar-ocorrencias"
import { getTolerancia, getTiposAtivos } from "@/lib/espelho/config"
import { periodoDe, parseQyonEspelho } from "@/lib/espelho/parse-qyon"
import { aplicarVirada } from "@/lib/espelho/virada"
import {
  buildDayResolver,
  hasResolverSchedule,
  EMPLOYEE_JORNADA_SELECT,
} from "@/lib/jornada"
import { sendAndLogWhatsapp } from "@/lib/whatsapp/send"
import { buildEspelhoMessage } from "@/lib/whatsapp/templates"

export type EspelhoDiaView = {
  data: string
  marcacoes: string[]
  tipo: string
  detalhe?: string
}

export type EspelhoItem = {
  matricula: string
  nome: string
  employeeId: string | null
  phone: string | null
  matched: boolean
  dias: EspelhoDiaView[]
  message: string
  onDutyToday: boolean | null
}

export type EspelhoState =
  | {
      status: "preview" | "error"
      message?: string
      competencia?: string
      items?: EspelhoItem[]
    }
  | undefined

export async function previewEspelho(
  _prev: EspelhoState,
  formData: FormData
): Promise<EspelhoState> {
  await requireSector("rh")

  const file = formData.get("file")
  const competencia = String(formData.get("competencia") || "")
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione o arquivo TXT do espelho." }
  }
  if (!competencia) {
    return { status: "error", message: "Selecione a competência." }
  }

  let colaboradores
  try {
    colaboradores = parseQyonEspelho(await file.arrayBuffer(), competencia)
  } catch {
    return { status: "error", message: "Não foi possível ler o arquivo." }
  }

  const employees = await prisma.employee.findMany({
    select: { ...EMPLOYEE_JORNADA_SELECT, phone: true },
  })
  const index = buildEmployeeIndex(employees)

  const [tolerancia, tiposAtivos] = await Promise.all([
    getTolerancia(),
    getTiposAtivos(),
  ])

  // Mesmo limite de período do Encerramento: detecção só na janela do arquivo.
  const janelaArq = periodoDe(colaboradores)
  const rangeStart = competenciaRange(competencia).start
  const inicioEfetivo =
    janelaArq && janelaArq.inicio.getTime() > rangeStart.getTime()
      ? janelaArq.inicio
      : rangeStart
  const fimPeriodo = janelaArq?.fim ?? null

  const today = new Date()
  const items: EspelhoItem[] = []
  for (const c of colaboradores) {
    const emp = index.find(c.matricula, c.nome)

    // Detecção unificada com o Encerramento de espelho: com jornada cadastrada usa a
    // detecção completa (falta, atraso, hora extra...); sem jornada, só marcação ímpar.
    let dias: EspelhoDiaView[]
    if (emp && hasResolverSchedule(emp)) {
      const resolver = buildDayResolver(emp)
      const diasColab = aplicarVirada(c.dias, resolver, inicioEfetivo)
      const ocorr = detectarOcorrencias(
        diasColab,
        resolver,
        tolerancia,
        competencia,
        tiposAtivos,
        undefined,
        fimPeriodo,
        inicioEfetivo
      )
      dias = ocorr.map((o) => ({
        data: formatDate(o.data),
        marcacoes: o.marcacoes,
        tipo: OCORRENCIA_LABEL[o.tipo],
        detalhe: o.detalhe,
      }))
    } else {
      dias = diasComOcorrencia(c.dias).map((d) => ({
        data: formatDate(d.data),
        marcacoes: d.marcacoes,
        tipo: OCORRENCIA_LABEL.IMPAR,
      }))
    }
    if (dias.length === 0) continue

    const nome = emp?.name ?? c.nome
    const onDutyToday =
      emp && hasResolverSchedule(emp) ? buildDayResolver(emp)(today) !== null : null
    items.push({
      matricula: c.matricula,
      nome,
      employeeId: emp?.id ?? null,
      phone: emp?.phone ?? null,
      matched: !!emp,
      dias,
      message: buildEspelhoMessage({ nome, competencia, dias }),
      onDutyToday,
    })
  }

  items.sort((a, b) => a.nome.localeCompare(b.nome))
  return { status: "preview", competencia, items }
}

export async function enviarWhatsapp(input: {
  employeeId: string | null
  matricula: string | null
  nome: string
  phone: string | null
  competencia: string
  message: string
}): Promise<{ ok: boolean; error?: string }> {
  await requireSectorEdit("rh")

  const result = await sendAndLogWhatsapp(
    {
      employeeId: input.employeeId,
      matricula: input.matricula,
      employeeName: input.nome,
      phone: input.phone,
      competencia: input.competencia,
    },
    input.message
  )

  return { ok: result.ok, error: result.error }
}
