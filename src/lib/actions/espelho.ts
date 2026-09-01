"use server"

import { requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { sendAndLogWhatsapp } from "@/lib/whatsapp/send"

// Aviso de ponto ao colaborador. O destinatário vem do BANCO, não do cliente: a tela
// manda só o id do espelho e o texto (que o operador pode ter editado). Antes o telefone
// vinha no payload do preview em memória, o que permitia enviar para qualquer número.
export async function enviarEspelhoWhatsapp(input: {
  fechamentoId: string
  message: string
}): Promise<{ ok: boolean; error?: string }> {
  await requireModuloEdit("PONTO")

  const message = input.message.trim()
  if (!message) return { ok: false, error: "Mensagem vazia." }

  const f = await prisma.espelhoFechamento.findUnique({
    where: { id: input.fechamentoId },
    select: {
      competencia: true,
      employee: {
        select: { id: true, name: true, phone: true, matricula: true },
      },
    },
  })
  if (!f) return { ok: false, error: "Espelho não encontrado." }
  if (!f.employee.phone) {
    return { ok: false, error: "Colaborador sem telefone cadastrado." }
  }

  const result = await sendAndLogWhatsapp(
    {
      employeeId: f.employee.id,
      matricula: f.employee.matricula,
      employeeName: f.employee.name,
      phone: f.employee.phone,
      competencia: f.competencia,
    },
    message
  )

  return { ok: result.ok, error: result.error }
}
