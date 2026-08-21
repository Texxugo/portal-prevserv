import { timingSafeEqual } from "node:crypto"

import { processarRespostaWhatsapp } from "@/lib/painel/convite"

// Webhook "Ao receber" da Z-API. É por aqui que a resposta do colaborador ao
// convite de extra volta para o portal.
//
// Configuração na Z-API (Webhooks → Ao receber):
//   https://SEU-DOMINIO/api/whatsapp/webhook/<ZAPI_WEBHOOK_TOKEN>
//
// A Z-API não assina as requisições, então o token no caminho é a única prova
// de origem — trate-o como senha e não o reaproveite em outro lugar.

export const dynamic = "force-dynamic"

function tokenConfere(recebido: string): boolean {
  const esperado = process.env.ZAPI_WEBHOOK_TOKEN ?? ""
  if (esperado.length < 16) return false // token fraco ou ausente = webhook desligado
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

// A Z-API muda o formato conforme o tipo de mensagem. Só três coisas
// interessam: de quem veio, o texto e — quando a conexão suporta botões — o id
// do botão apertado.
type ZapiWebhook = {
  phone?: string
  fromMe?: boolean
  isGroup?: boolean
  isNewsletter?: boolean
  type?: string
  text?: { message?: string } | string
  buttonsResponseMessage?: { buttonId?: string; message?: string }
  listResponseMessage?: { selectedRowId?: string; message?: string; title?: string }
  hydratedTemplate?: { message?: string }
}

function extrairTexto(body: ZapiWebhook): string | null {
  if (typeof body.text === "string") return body.text
  return (
    body.text?.message ??
    body.buttonsResponseMessage?.message ??
    body.listResponseMessage?.message ??
    body.listResponseMessage?.title ??
    null
  )
}

function extrairBotao(body: ZapiWebhook): string | null {
  return (
    body.buttonsResponseMessage?.buttonId ??
    body.listResponseMessage?.selectedRowId ??
    null
  )
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params
  if (!tokenConfere(token)) {
    return new Response("não autorizado", { status: 404 })
  }

  let body: ZapiWebhook
  try {
    body = (await request.json()) as ZapiWebhook
  } catch {
    return Response.json({ ok: false, erro: "corpo inválido" }, { status: 400 })
  }

  // Eco das próprias mensagens, grupo e newsletter não são resposta de ninguém.
  if (body.fromMe || body.isGroup || body.isNewsletter || !body.phone) {
    return Response.json({ ok: true, ignorado: true })
  }

  try {
    const resultado = await processarRespostaWhatsapp({
      phoneRaw: body.phone,
      texto: extrairTexto(body),
      botaoId: extrairBotao(body),
    })
    return Response.json({ ok: true, resultado })
  } catch (e) {
    // 200 de propósito: a Z-API reenfileira o que falha, e uma exceção nossa
    // viraria a mesma mensagem chegando de novo em looping.
    console.error("[whatsapp-webhook] falha ao processar:", e)
    return Response.json({ ok: false })
  }
}

// A Z-API faz uma chamada de verificação ao salvar a URL.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params
  if (!tokenConfere(token)) return new Response("não autorizado", { status: 404 })
  return Response.json({ ok: true, servico: "portal-prev/whatsapp-webhook" })
}
