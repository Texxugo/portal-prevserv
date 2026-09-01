import { NextRequest, NextResponse } from "next/server"

// A planilha mudou de rota junto com a tela; o link antigo continua servindo o arquivo.
export async function GET(req: NextRequest) {
  const comp = req.nextUrl.searchParams.get("comp")
  return NextResponse.redirect(
    new URL(`/rh/ponto/export${comp ? `?comp=${comp}` : ""}`, req.nextUrl.origin)
  )
}
