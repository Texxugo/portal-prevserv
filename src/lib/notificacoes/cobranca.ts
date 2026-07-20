import { Prisma } from "@prisma/client"

import { currentCompetencia } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { buildDayResolver, EMPLOYEE_JORNADA_SELECT } from "@/lib/jornada"
import { sendAndLogWhatsapp } from "@/lib/whatsapp/send"
import { getCobrancaPhone } from "./config"

const DAY_MS = 86_400_000

type PendenciaComEmployee = Prisma.DocumentoPendenciaGetPayload<{
  include: {
    documentType: { select: { name: true } }
    employee: { select: typeof EMPLOYEE_JORNADA_SELECT }
  }
}>

// Notifica pendências de cobrança cuja data de retorno é HOJE, 30 min após o
// horário de entrada do funcionário — e somente se ele estiver escalado hoje.
export async function tickCobranca(now: Date = new Date()): Promise<void> {
  // Dia-calendário LOCAL do servidor materializado como meia-noite UTC:
  // followUpDate é gravado como new Date("YYYY-MM-DD") (meia-noite UTC) e o
  // resolver de jornada usa getUTCDay().
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const isoDay = todayUtc.toISOString().slice(0, 10)

  const pendencias = await prisma.documentoPendencia.findMany({
    where: {
      status: { in: ["PENDENTE", "SOLICITADO"] },
      followUpDate: { gte: todayUtc, lt: new Date(todayUtc.getTime() + DAY_MS) },
      // freelancers (sem cadastro) ficam fora: sem jornada não há horário de entrada
      employeeId: { not: null },
    },
    include: {
      documentType: { select: { name: true } },
      employee: { select: EMPLOYEE_JORNADA_SELECT },
    },
  })
  if (pendencias.length === 0) return

  const byEmp = new Map<string, PendenciaComEmployee[]>()
  for (const p of pendencias) {
    if (!p.employee) continue
    const list = byEmp.get(p.employee.id) ?? []
    list.push(p)
    byEmp.set(p.employee.id, list)
  }

  const nowMin = now.getHours() * 60 + now.getMinutes() // hora LOCAL

  for (const [empId, list] of byEmp) {
    const emp = list[0].employee!
    const day = buildDayResolver(emp)(todayUtc)
    if (!day?.entrada) continue // folga ou sem jornada → não escalado hoje
    const [h, m] = day.entrada.split(":").map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue
    if (nowMin < h * 60 + m + 30) continue // ainda não passou entrada + 30min

    await notificar(empId, emp, day.entrada, list, isoDay)
  }
}

async function notificar(
  empId: string,
  emp: NonNullable<PendenciaComEmployee["employee"]>,
  entrada: string,
  list: PendenciaComEmployee[],
  isoDay: string
) {
  // Dedupe: consulta antes do create (evita spam de prisma:error P2002 a cada
  // tick); o catch abaixo cobre apenas a corrida entre dois ticks simultâneos.
  const dedupeKey = `cobranca:${empId}:${isoDay}`
  const existente = await prisma.notificacao.findUnique({
    where: { dedupeKey },
    select: { id: true },
  })
  if (existente) return

  try {
    await prisma.notificacao.create({
      data: {
        tipo: "COBRANCA_PENDENCIA",
        title: `Cobrar documentos de ${emp.name}`,
        message: `${list.length} pendência(s) com retorno hoje · entrada ${entrada}.`,
        href: "/rh/pendencias",
        dedupeKey,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return
    }
    throw e
  }

  const phone = await getCobrancaPhone()
  if (!phone) return

  const docs = list.map(
    (p) =>
      `- ${p.documentType.name}${p.reason?.trim() ? ` (${p.reason.trim()})` : ""}`
  )
  const message =
    `Lembrete de cobrança de documentos\n\n` +
    `Colaborador: ${emp.name}${emp.matricula ? ` (mat. ${emp.matricula})` : ""}\n` +
    `Entrada hoje: ${entrada}\n\n` +
    `Pendências com retorno hoje:\n${docs.join("\n")}\n\n` +
    `Acesse o portal em /rh/pendencias para cobrar.`

  await sendAndLogWhatsapp(
    {
      employeeId: empId,
      matricula: emp.matricula,
      employeeName: emp.name,
      phone,
      competencia: currentCompetencia(),
    },
    message
  )
}
