import * as XLSX from "xlsx"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { canView } from "@/lib/permissions"
import { competenciaLabel } from "@/lib/competencia"
import { formatDate } from "@/lib/format"
import {
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user || !canView(session.user.role, "rh")) {
    return new Response("Não autorizado", { status: 403 })
  }

  const competencia = new URL(req.url).searchParams.get("comp") || ""
  const fechs = await prisma.espelhoFechamento.findMany({
    where: { competencia },
    include: {
      employee: { select: { name: true, matricula: true } },
      ocorrencias: { orderBy: { data: "asc" } },
    },
    orderBy: { employee: { name: "asc" } },
  })

  const rows: Record<string, string>[] = []
  for (const f of fechs) {
    for (const o of f.ocorrencias) {
      rows.push({
        Matrícula: f.employee.matricula ?? "",
        Colaborador: f.employee.name,
        Status: f.status,
        Data: formatDate(o.data),
        Tipo: OCORRENCIA_LABEL[o.tipo as OcorrenciaTipo] ?? o.tipo,
        Detalhe: o.detalhe,
        Marcações: o.marcacoes,
        Categoria: o.justificativaCategoria ?? "",
        Observação: o.justificativaObs ?? "",
        Resolvido: o.resolvido ? "Sim" : "Não",
      })
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Fechamento")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

  const nome = `fechamento-${competenciaLabel(competencia).replace("/", "-")}.xlsx`
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  })
}
