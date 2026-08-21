const BASE = "https://api.z-api.io"

export type SendResult = { ok: boolean; messageId?: string; error?: string }

// Normaliza para o formato do WhatsApp/Z-API: DDI 55 + DDD + número (só dígitos).
export function normalizePhone(raw: string): string {
  let digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "")
  if (!digits) return ""
  if (!digits.startsWith("55")) digits = "55" + digits
  return digits
}

// ID de grupo da Z-API. NÃO passa por normalizePhone — o prefixo 55
// destruiria o identificador. Aqui só tiramos o ruído de digitação; quem
// decide se o valor presta é isGrupoIdValido.
export function normalizeGrupoId(raw: string): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/@g\.us$/, "")
    .replace(/\s+/g, "")
}

// Dois formatos convivem no WhatsApp:
// - atual (desde nov/2021): "120263358412332916-group" — sufixo literal
//   "group", e é o que a Z-API devolve em GET /groups;
// - legado: "5511999999999-1623281429" — telefone do criador + timestamp.
//
// Um TELEFONE solto tem de ser rejeitado: cai no campo errado com facilidade e
// mandaria o relatório do posto para uma pessoa, sem erro visível. É por isso
// que o formato legado exige o segundo grupo de dígitos, e o ID nu exige 15+
// (celular brasileiro com DDI chega no máximo a 13).
const GRUPO_ATUAL = /^\d{15,}-group$/
const GRUPO_LEGADO = /^\d{10,}-\d{6,}$/
const GRUPO_NU = /^\d{15,}$/

export function isGrupoIdValido(raw: string): boolean {
  const id = normalizeGrupoId(raw)
  return GRUPO_ATUAL.test(id) || GRUPO_LEGADO.test(id) || GRUPO_NU.test(id)
}

// Envio cru: `destination` já vem pronto (telefone normalizado ou ID de grupo).
async function postText(
  destination: string,
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

  try {
    const res = await fetch(
      `${BASE}/instances/${instance}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "Client-Token": clientToken } : {}),
        },
        body: JSON.stringify({ phone: destination, message }),
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

export async function sendText(
  phoneRaw: string,
  message: string
): Promise<SendResult> {
  const phone = normalizePhone(phoneRaw)
  if (!phone || phone.length < 12) {
    return { ok: false, error: "Telefone do colaborador ausente ou inválido." }
  }
  return postText(phone, message)
}

export type BotaoWhatsapp = { id: string; label: string }

/**
 * Mensagem com botões de resposta. Nem toda conexão da Z-API aceita botões
 * (depende do tipo de conta do WhatsApp), então a falha aqui NÃO é erro: o
 * chamador cai para `sendText` com as opções numeradas, e o webhook entende as
 * duas formas de resposta.
 */
export async function sendButtons(
  phoneRaw: string,
  message: string,
  botoes: BotaoWhatsapp[]
): Promise<SendResult> {
  const phone = normalizePhone(phoneRaw)
  if (!phone || phone.length < 12) {
    return { ok: false, error: "Telefone do colaborador ausente ou inválido." }
  }

  const instance = process.env.ZAPI_INSTANCE
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  if (!instance || !token) {
    return { ok: false, error: "Z-API não configurada." }
  }

  try {
    const res = await fetch(
      `${BASE}/instances/${instance}/token/${token}/send-button-list`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "Client-Token": clientToken } : {}),
        },
        body: JSON.stringify({
          phone,
          message,
          buttonList: { buttons: botoes.map((b) => ({ id: b.id, label: b.label })) },
        }),
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

// Envio ao grupo do posto (relatório diário).
export async function sendGroupText(
  grupoIdRaw: string,
  message: string
): Promise<SendResult> {
  if (!isGrupoIdValido(grupoIdRaw)) {
    return { ok: false, error: "ID do grupo de WhatsApp ausente ou inválido." }
  }
  return postText(normalizeGrupoId(grupoIdRaw), message)
}

export type GrupoWhatsapp = { id: string; nome: string }

// GET /groups — lista os grupos de que a conta conectada participa, para o
// usuário escolher o do posto sem precisar descobrir o ID em lugar nenhum.
// Só leitura: não manda mensagem.
export async function listGroups(): Promise<{
  ok: boolean
  grupos?: GrupoWhatsapp[]
  error?: string
}> {
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

  try {
    const res = await fetch(
      `${BASE}/instances/${instance}/token/${token}/groups?page=1&pageSize=200`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "Client-Token": clientToken } : {}),
        },
        cache: "no-store",
      }
    )
    const data = (await res.json().catch(() => null)) as
      | { phone?: string; name?: string; isGroup?: boolean }[]
      | { error?: string; message?: string }
      | null

    if (!res.ok) {
      const erro = Array.isArray(data) ? null : data
      return {
        ok: false,
        error: erro?.error || erro?.message || `HTTP ${res.status}`,
      }
    }
    if (!Array.isArray(data)) {
      return { ok: false, error: "Resposta inesperada da Z-API." }
    }

    return {
      ok: true,
      grupos: data
        .filter((g) => g.phone && g.isGroup !== false)
        .map((g) => ({ id: g.phone as string, nome: g.name || "(sem nome)" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao consultar os grupos",
    }
  }
}
