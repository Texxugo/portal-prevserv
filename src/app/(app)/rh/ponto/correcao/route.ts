import { Prisma } from "@prisma/client"

import { actorName, getAccess } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { formatDate } from "@/lib/format"
import { podeEditar } from "@/lib/permissions"
import {
  contarCamposFaltantes,
  docxCorrecao,
  gerarCodigoCorrecao,
  nomeArquivoCorrecao,
  pdfCorrecao,
  type CorrecaoDoc,
} from "@/lib/espelho/correcao"
import { buildDayResolver, EMPLOYEE_JORNADA_SELECT } from "@/lib/jornada"

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const

// GET /rh/ponto/correcao?occ=<ocorrência>&formato=docx|pdf
//
// Emite o documento de correção de uma "Marcação incompleta". A primeira
// emissão grava o registro com o código; as seguintes reimprimem o MESMO
// código — DOCX e PDF são duas impressões do mesmo papel.
export async function GET(req: Request) {
  const access = await getAccess()
  // Emitir é ato de tratativa do ponto, como solicitar documento: exige edição.
  if (!access || !podeEditar(access, "PONTO")) {
    return new Response("Não autorizado", { status: 403 })
  }

  const url = new URL(req.url)
  const occ = url.searchParams.get("occ") || ""
  const formato = url.searchParams.get("formato") === "pdf" ? "pdf" : "docx"

  const ocorrencia = await prisma.espelhoOcorrencia.findUnique({
    where: { id: occ },
    include: {
      correcao: true,
      fechamento: {
        include: {
          // A jornada vem junto: é ela que diz quantas batidas o dia esperava,
          // e daí quantos campos o papel precisa pedir à mão.
          employee: {
            select: {
              ...EMPLOYEE_JORNADA_SELECT,
              cpf: true,
              empresa: true,
            },
          },
        },
      },
    },
  })
  if (!ocorrencia) return new Response("Ocorrência não encontrada", { status: 404 })
  if (ocorrencia.tipo !== "IMPAR") {
    return new Response(
      "O documento de correção só vale para marcação incompleta.",
      { status: 400 }
    )
  }

  const { employee } = ocorrencia.fechamento
  let correcao = ocorrencia.correcao

  if (!correcao) {
    const dados = {
      codigo: gerarCodigoCorrecao(ocorrencia.data),
      occurrenceId: ocorrencia.id,
      employeeId: employee.id,
      employeeName: employee.name,
      cpf: employee.cpf,
      matricula: employee.matricula,
      empresa: employee.empresa,
      competencia: ocorrencia.fechamento.competencia,
      data: ocorrencia.data,
      marcacoes: ocorrencia.marcacoes,
      camposFaltantes: contarCamposFaltantes(
        ocorrencia.marcacoes,
        buildDayResolver(employee)(ocorrencia.data)
      ),
      actorUserId: access.id,
      actorName: actorName(access),
    }
    try {
      correcao = await prisma.$transaction(async (tx) => {
        const criada = await tx.pontoCorrecao.create({ data: dados })
        await tx.espelhoEvento.create({
          data: {
            fechamentoId: ocorrencia.fechamentoId,
            action: "CORRECAO_GERADA",
            description: `Documento de correção ${criada.codigo} — ${formatDate(
              ocorrencia.data
            )}`,
            actorUserId: dados.actorUserId,
            actorName: dados.actorName,
          },
        })
        return criada
      })
    } catch (e) {
      // Dois cliques ao mesmo tempo (ou DOCX e PDF juntos): o unique de
      // occurrenceId barra o segundo. Reaproveita o documento que venceu a
      // corrida em vez de devolver erro para quem só queria imprimir.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        correcao = await prisma.pontoCorrecao.findUnique({
          where: { occurrenceId: ocorrencia.id },
        })
      }
      if (!correcao) throw e
    }
  }

  const doc: CorrecaoDoc = {
    codigo: correcao.codigo,
    employeeName: correcao.employeeName,
    cpf: correcao.cpf,
    matricula: correcao.matricula,
    empresa: correcao.empresa,
    competencia: correcao.competencia,
    data: correcao.data,
    marcacoes: correcao.marcacoes,
    detalhe: ocorrencia.detalhe,
    camposFaltantes: correcao.camposFaltantes,
    emitidoPor: correcao.actorName,
    emitidoEm: correcao.createdAt,
  }

  const arquivo =
    formato === "pdf" ? await pdfCorrecao(doc) : await docxCorrecao(doc)

  return new Response(arquivo as unknown as BodyInit, {
    headers: {
      "Content-Type": MIME[formato],
      "Content-Disposition": `attachment; filename="${nomeArquivoCorrecao(
        doc,
        formato
      )}"`,
      // Documento assinável: nunca servir de cache do navegador.
      "Cache-Control": "no-store",
    },
  })
}
