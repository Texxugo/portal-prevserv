const BASE = "https://api.z-api.io"

export type SendResult = { ok: boolean; messageId?: string; error?: string }

// Normaliza para o formato do WhatsApp/Z-API: DDI 55 + DDD + número (só dígitos).
export function normalizePhone(raw: string): string {
  let digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "")
  if (!digits) return ""
  if (!digits.startsWith("55")) digits = "55" + digits
  return digits
}

export async function sendText(
  phoneRaw: string,
  message: string
): Promise<SendResult> {
  const instance = process.env.ZAPI_INSTANCE
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instance || !token) {
    return {
      ok: false,
      error:
        "Z-API não configurada. Defina ZAPI_INSTANCE e ZAPI_TOKEN (e ZAPI_CLIENT_TOKEN) no .env.",
    }
  }

  const phone = normalizePhone(phoneRaw)
  if (!phone || phone.length < 12) {
    return { ok: false, error: "Telefone do colaborador ausente ou inválido." }
  }

  try {
    const res = await fetch(
      `${BASE}/instances/${instance}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "Client-Token": clientToken } : {}),
        },
        body: JSON.stringify({ phone, message }),
      }
    )
    const data = (await res.json().catch(() => null)) as
      | { messageId?: string; id?: string; error?: string; message?: string }
      | null
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || data?.message || `HTTP ${res.status}`,
      }
    }
    return { ok: true, messageId: data?.messageId || data?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar" }
  }
}
