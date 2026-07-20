import { prisma } from "@/lib/db"
import { sendText, type SendResult } from "@/lib/zapi"

// Envio de WhatsApp + gravação em WhatsappMessageLog num único ponto.
// Sem telefone não chama a rede: registra o erro no log e retorna ok: false.

export type WhatsappTarget = {
  employeeId: string | null
  matricula: string | null
  employeeName: string
  phone: string | null
  competencia: string
}

export async function sendAndLogWhatsapp(
  target: WhatsappTarget,
  message: string
): Promise<SendResult> {
  const result: SendResult = target.phone
    ? await sendText(target.phone, message)
    : { ok: false, error: "Colaborador sem telefone cadastrado." }

  await prisma.whatsappMessageLog.create({
    data: {
      employeeId: target.employeeId,
      matricula: target.matricula,
      employeeName: target.employeeName,
      phone: target.phone ?? "",
      competencia: target.competencia,
      message,
      status: result.ok ? "ENVIADO" : "ERRO",
      zaapiMessageId: result.ok ? (result.messageId ?? null) : null,
      error: result.ok ? null : (result.error ?? null),
    },
  })

  return result
}
