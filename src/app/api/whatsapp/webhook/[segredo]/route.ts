import { NextResponse } from "next/server"

type RouteContext = {
  params: Promise<{
    segredo: string
  }>
}

function montarUrlDestino(segredo: string) {
  const urlConfigurada = process.env.PONTO_WEBHOOK_URL?.trim()

  if (urlConfigurada) {
    return urlConfigurada
  }

  return `http://localhost:3333/api/whatsapp/webhook/${segredo}`
}

export async function GET(_request: Request, context: RouteContext) {
  const { segredo } = await context.params

  return NextResponse.json({
    ok: true,
    servico: "webhook-whatsapp",
    configurado: true,
    mensagem:
      "Webhook ativo. O recebimento real usa POST e repassa para o sistema de ponto.",
    destino: montarUrlDestino(segredo).replace(segredo, "<segredo>"),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { segredo } = await context.params
  const body = await request.text()
  const contentType = request.headers.get("content-type") ?? "application/json"
  const destino = montarUrlDestino(segredo)

  try {
    const resposta = await fetch(destino, {
      method: "POST",
      headers: {
        "content-type": contentType,
      },
      body,
    })

    if (!resposta.ok) {
      console.error(
        `[whatsapp-webhook] Falha ao repassar para o ponto: ${resposta.status} ${resposta.statusText}`,
      )
    }

    return NextResponse.json({
      ok: true,
      repassado: resposta.ok,
    })
  } catch (error) {
    console.error("[whatsapp-webhook] Erro ao repassar para o ponto:", error)

    return NextResponse.json(
      {
        ok: false,
        repassado: false,
        mensagem: "Mensagem recebida, mas nao foi possivel repassar ao ponto.",
      },
      { status: 502 },
    )
  }
}
