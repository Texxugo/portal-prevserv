import { Document, Packer, Paragraph, TextRun } from "docx"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { canView } from "@/lib/permissions"

// "YYYY-MM" → "MM/AAAA" (formato do cabeçalho do relatório).
function compHeader(comp: string): string {
  const [y, m] = comp.split("-")
  return y && m ? `${m}/${y}` : comp
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user || !canView(session.user.role, "rh")) {
    return new Response("Não autorizado", { status: 403 })
  }

  const competencia = new URL(req.url).searchParams.get("comp") || ""

  const [employees, apontamentos] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { not: "INATIVO" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.apontamento.findMany({ where: { competencia } }),
  ])
  const byEmp = new Map(apontamentos.map((a) => [a.employeeId, a]))

  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "RELATÓRIO DE APONTAMENTO", bold: true, size: 28 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `COMPETÊNCIA: ${compHeader(competencia)}`, bold: true })],
      spacing: { after: 200 },
    }),
  ]

  const line = (text: string) => new Paragraph({ children: [new TextRun(text)] })

  for (const e of employees) {
    const a = byEmp.get(e.id)

    paras.push(
      new Paragraph({
        children: [new TextRun({ text: e.name, bold: true })],
        spacing: { before: 240 },
      })
    )

    // Sempre presentes
    paras.push(line(`TOTAL: ${a?.total ?? 0}`))
    paras.push(line(`VALE TRANSPORTE: ${a?.valeTransporte ?? 0}`))
    paras.push(line(`VALE REFEICAO: ${a?.valeRefeicao ?? 0}`))

    // Condicionais (só quando preenchidos)
    if (a) {
      if (a.adicionalNoturno != null) paras.push(line(`ADICIONAL NOTURNO: ${a.adicionalNoturno}`))
      if (a.he50) paras.push(line(`HE 50(%): ${a.he50}`))
      if (a.he100) paras.push(line(`HE 100(%): ${a.he100}`))
      if (a.intra != null) paras.push(line(`INTRA: ${a.intra}`))
      if (a.faltasE != null || a.faltasF != null) {
        const e1 = a.faltasE ?? 0
        const f1 = a.faltasF ?? 0
        paras.push(line(`FALTAS TOTAL: ${e1 + f1} (${e1}E+${f1}F)`))
      }
      if (a.faltasJust != null) paras.push(line(`FALTAS JUST: ${a.faltasJust}`))
      if (a.faltasNJust != null) paras.push(line(`FALTAS N JUST: ${a.faltasNJust}`))
      if (a.dsr != null) paras.push(line(`DSR: ${a.dsr}`))
      if (a.gratPercent != null) paras.push(line(`GRAT( %): ${a.gratPercent}`))

      // Observações livres (1 linha por linha não vazia)
      for (const obs of (a.observacoes ?? "").split(/\r?\n/)) {
        if (obs.trim()) paras.push(line(obs.trim()))
      }
    }

    // Premiações (sempre)
    paras.push(line(`${a?.recebeCesta ?? true ? "RECEBE" : "NÃO RECEBE"} PREMIACAO DE CESTA`))
    paras.push(
      line(`${a?.recebeAssiduidade ?? true ? "RECEBE" : "NÃO RECEBE"} PREMIACAO DE ASSIDUIDADE`)
    )

    paras.push(
      new Paragraph({
        children: [
          new TextRun(
            "Assinatura do funcionario: _________________________________________________"
          ),
        ],
        spacing: { before: 120 },
      })
    )
  }

  const doc = new Document({ sections: [{ children: paras }] })
  const buf = await Packer.toBuffer(doc)

  const nome = `apontamento-${compHeader(competencia).replace("/", "-")}.docx`
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  })
}
