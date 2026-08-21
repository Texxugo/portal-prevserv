import { competenciaFromDate } from "@/lib/competencia"
import { prisma } from "@/lib/db"
import { distanciaKm } from "@/lib/geo/distancia"
import { formatDate, nomeProprio, primeiroNome } from "@/lib/format"
import {
  interpretarConvite,
  interpretarDeslocamento,
  OPCAO_ACEITAR,
  OPCAO_DESLOCAMENTO_NAO,
  OPCAO_DESLOCAMENTO_SIM,
  OPCAO_OPTOUT,
  OPCAO_RECUSAR,
} from "@/lib/painel/resposta"
import {
  buildConfirmacaoExtraMessage,
  buildConviteExtraMessage,
  buildDeslocamentoMessage,
  buildOptOutMessage,
  buildRecusaExtraMessage,
} from "@/lib/whatsapp/templates"
import {
  normalizePhone,
  sendButtons,
  sendText,
  type SendResult,
} from "@/lib/zapi"

// Convocação de extra: envio do convite e a conversa que vem depois.
//
// A máquina de estados vive no campo `etapa` do CoberturaConvite. É ela que diz
// ao webhook o que fazer com a próxima mensagem daquele telefone — sem isso,
// "1" tanto poderia significar "aceito" quanto "preciso de deslocamento".

const PERIODO_LABEL: Record<string, string> = {
  DIURNO: "diurno",
  NOTURNO: "noturno",
}

/**
 * Todo envio passa por aqui.
 *
 * O padrão é TEXTO com as opções numeradas, não botões. A Z-API responde 200 e
 * devolve messageId para `send-button-list` mesmo quando o WhatsApp descarta a
 * mensagem do lado de quem recebe — falha silenciosa, impossível de detectar
 * pelo retorno da API, e foi o que aconteceu no primeiro teste real. A própria
 * documentação da Z-API avisa que botões são instáveis e mudam a cada
 * atualização do WhatsApp.
 *
 * ZAPI_BOTOES=on liga a tentativa de botões, com queda para texto se a chamada
 * falhar. Só vale a pena se você confirmar, no aparelho, que os botões chegam.
 *
 * O canal usado volta junto para ficar registrado no convite: quando alguém
 * disser "não recebi", a primeira pergunta é por onde a mensagem saiu.
 */
async function enviarComOpcoes(
  phone: string,
  message: string,
  botoes: { id: string; label: string }[]
): Promise<SendResult & { canal: "BOTOES" | "TEXTO" }> {
  if (process.env.ZAPI_BOTOES === "on") {
    const comBotoes = await sendButtons(phone, message, botoes)
    if (comBotoes.ok) return { ...comBotoes, canal: "BOTOES" }
  }
  return { ...(await sendText(phone, message)), canal: "TEXTO" }
}

async function registrarLog(input: {
  employeeId: string
  matricula: string | null
  employeeName: string
  phone: string
  competencia: string
  message: string
  ok: boolean
  messageId?: string
  error?: string
}) {
  await prisma.whatsappMessageLog.create({
    data: {
      employeeId: input.employeeId,
      matricula: input.matricula,
      employeeName: input.employeeName,
      phone: input.phone,
      competencia: input.competencia,
      message: input.message,
      status: input.ok ? "ENVIADO" : "ERRO",
      zaapiMessageId: input.messageId ?? null,
      error: input.error ?? null,
    },
  })
}

export type EnvioConvite = { ok: boolean; error?: string; conviteId?: string }

export async function enviarConviteExtra(input: {
  vagaId: string
  employeeId: string
  criadoPor: string
}): Promise<EnvioConvite> {
  const [vaga, employee] = await Promise.all([
    prisma.coberturaVaga.findUnique({
      where: { id: input.vagaId },
      select: {
        id: true, date: true, periodo: true, horario: true, status: true,
        department: { select: { name: true, lat: true, lng: true } },
      },
    }),
    prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true, name: true, phone: true, matricula: true,
        whatsappOptOut: true, lat: true, lng: true,
      },
    }),
  ])

  if (!vaga) return { ok: false, error: "Baixa não encontrada." }
  if (vaga.status !== "ABERTA") {
    return { ok: false, error: "Esta baixa já foi encerrada." }
  }
  if (!employee) return { ok: false, error: "Colaborador não encontrado." }
  if (employee.whatsappOptOut) {
    return {
      ok: false,
      error: `${employee.name} pediu para não receber convites por WhatsApp.`,
    }
  }
  const phone = normalizePhone(employee.phone ?? "")
  if (!phone || phone.length < 12) {
    return { ok: false, error: `${employee.name} não tem telefone válido no cadastro.` }
  }

  // Um convite em aberto por pessoa e vaga: reenviar viraria cobrança em cima
  // de quem ainda nem teve tempo de ler.
  const jaConvidado = await prisma.coberturaConvite.findFirst({
    where: {
      vagaId: vaga.id,
      employeeId: employee.id,
      status: { in: ["ENVIADO", "ACEITO"] },
    },
    select: { id: true },
  })
  if (jaConvidado) {
    return { ok: false, error: `${employee.name} já foi convidado para esta baixa.` }
  }

  const km =
    vaga.department.lat !== null &&
    vaga.department.lng !== null &&
    employee.lat !== null &&
    employee.lng !== null
      ? distanciaKm(
          { lat: employee.lat, lng: employee.lng },
          { lat: vaga.department.lat, lng: vaga.department.lng }
        )
      : null

  const message = buildConviteExtraMessage({
    // Nome completo: é convocação de trabalho, e o nome inteiro deixa claro que
    // a mensagem é para aquela pessoa, não um disparo em massa.
    nome: nomeProprio(employee.name),
    posto: vaga.department.name,
    data: formatDate(vaga.date),
    periodo: PERIODO_LABEL[vaga.periodo] ?? vaga.periodo,
    horario: vaga.horario,
  })

  const envio = await enviarComOpcoes(phone, message, [
    { id: OPCAO_ACEITAR, label: "Aceitar" },
    { id: OPCAO_RECUSAR, label: "Recusar" },
    { id: OPCAO_OPTOUT, label: "Não receber mais" },
  ])

  const competencia = competenciaFromDate(vaga.date)
  await registrarLog({
    employeeId: employee.id,
    matricula: employee.matricula,
    employeeName: employee.name,
    phone,
    competencia,
    message,
    ok: envio.ok,
    messageId: envio.messageId,
    error: envio.error,
  })

  // O convite é gravado mesmo quando o envio falha: sem a linha, o painel não
  // teria como mostrar que a tentativa existiu nem por que não chegou.
  const convite = await prisma.coberturaConvite.create({
    data: {
      vagaId: vaga.id,
      employeeId: employee.id,
      phone,
      status: envio.ok ? "ENVIADO" : "ERRO",
      etapa: envio.ok ? "AGUARDANDO_RESPOSTA" : "CONCLUIDO",
      distanciaKm: km,
      canal: envio.canal,
      zaapiMessageId: envio.messageId ?? null,
      erro: envio.ok ? null : (envio.error ?? "Falha ao enviar."),
      criadoPor: input.criadoPor,
    },
    select: { id: true },
  })

  return envio.ok
    ? { ok: true, conviteId: convite.id }
    : { ok: false, error: envio.error ?? "Falha ao enviar.", conviteId: convite.id }
}

// ---------- Resposta recebida ----------

export type ResultadoResposta =
  | { tratado: true; acao: "ACEITO" | "RECUSADO" | "OPTOUT" | "DESLOCAMENTO" }
  | { tratado: false; motivo: "SEM_CONVITE" | "NAO_ENTENDIDO" }

/**
 * Ponto de entrada do webhook. Procura o convite em aberto daquele telefone e
 * avança a conversa. Sempre o MAIS RECENTE: se a pessoa foi convidada para duas
 * baixas, a resposta se refere à última mensagem que ela recebeu.
 */
export async function processarRespostaWhatsapp(input: {
  phoneRaw: string
  texto: string | null
  botaoId: string | null
}): Promise<ResultadoResposta> {
  const phone = normalizePhone(input.phoneRaw)
  if (!phone) return { tratado: false, motivo: "SEM_CONVITE" }

  const convite = await prisma.coberturaConvite.findFirst({
    where: { phone, etapa: { in: ["AGUARDANDO_RESPOSTA", "AGUARDANDO_DESLOCAMENTO"] } },
    orderBy: { enviadoAt: "desc" },
    select: {
      id: true, etapa: true, vagaId: true, respostaTexto: true,
      employee: { select: { id: true, name: true, matricula: true } },
      vaga: { select: { date: true } },
    },
  })
  if (!convite) return { tratado: false, motivo: "SEM_CONVITE" }

  // Nas mensagens de acompanhamento a conversa já está aberta, então o primeiro
  // nome basta — mas sem a CAIXA ALTA em que o cadastro guarda.
  const tratamento = primeiroNome(convite.employee.name)
  const competencia = competenciaFromDate(convite.vaga.date)
  const texto = input.texto ?? ""

  const responder = async (message: string, botoes?: { id: string; label: string }[]) => {
    const envio = botoes
      ? await enviarComOpcoes(phone, message, botoes)
      : await sendText(phone, message)
    await registrarLog({
      employeeId: convite.employee.id,
      matricula: convite.employee.matricula,
      employeeName: convite.employee.name,
      phone,
      competencia,
      message,
      ok: envio.ok,
      messageId: envio.messageId,
      error: envio.error,
    })
  }

  // Resposta que não dá para classificar: reapresenta as opções UMA vez. Sem
  // esse limite, um "obrigado" do colaborador viraria uma troca infinita.
  const naoEntendi = async (reapresentar: string) => {
    if (convite.respostaTexto === null) {
      await prisma.coberturaConvite.update({
        where: { id: convite.id },
        data: { respostaTexto: texto || "(sem texto)" },
      })
      await responder(reapresentar)
    }
    return { tratado: false, motivo: "NAO_ENTENDIDO" } as const
  }

  if (convite.etapa === "AGUARDANDO_RESPOSTA") {
    const resposta = interpretarConvite(texto, input.botaoId)

    if (resposta === "ACEITAR") {
      await prisma.coberturaConvite.update({
        where: { id: convite.id },
        data: {
          status: "ACEITO",
          etapa: "AGUARDANDO_DESLOCAMENTO",
          respondidoAt: new Date(),
          respostaTexto: texto || "Aceitar",
        },
      })
      await responder(buildDeslocamentoMessage(tratamento), [
        { id: OPCAO_DESLOCAMENTO_SIM, label: "Sim, preciso" },
        { id: OPCAO_DESLOCAMENTO_NAO, label: "Não, tenho como ir" },
      ])
      return { tratado: true, acao: "ACEITO" }
    }

    if (resposta === "RECUSAR") {
      await prisma.coberturaConvite.update({
        where: { id: convite.id },
        data: {
          status: "RECUSADO",
          etapa: "CONCLUIDO",
          respondidoAt: new Date(),
          respostaTexto: texto || "Recusar",
        },
      })
      await responder(buildRecusaExtraMessage(tratamento))
      return { tratado: true, acao: "RECUSADO" }
    }

    if (resposta === "OPTOUT") {
      // O pedido vale para a pessoa, não para este convite: os demais convites
      // em aberto dela são encerrados junto, senão ela continuaria respondendo
      // mensagens que pediu para não receber.
      await prisma.$transaction([
        prisma.coberturaConvite.update({
          where: { id: convite.id },
          data: {
            status: "OPTOUT",
            etapa: "CONCLUIDO",
            respondidoAt: new Date(),
            respostaTexto: texto || "Não receber mais",
          },
        }),
        prisma.coberturaConvite.updateMany({
          where: {
            employeeId: convite.employee.id,
            id: { not: convite.id },
            etapa: { not: "CONCLUIDO" },
          },
          data: { status: "CANCELADO", etapa: "CONCLUIDO" },
        }),
        prisma.employee.update({
          where: { id: convite.employee.id },
          data: { whatsappOptOut: true, whatsappOptOutAt: new Date() },
        }),
      ])
      await responder(buildOptOutMessage(tratamento))
      return { tratado: true, acao: "OPTOUT" }
    }

    return naoEntendi(
      `Desculpe, ${tratamento}, não entendi. Responda com o número da opção:\n*1* - Aceitar\n*2* - Recusar\n*3* - Não receber mais mensagens`
    )
  }

  const deslocamento = interpretarDeslocamento(texto, input.botaoId)
  if (deslocamento === null) {
    return naoEntendi(
      `Desculpe, ${tratamento}, não entendi. Você precisa de deslocamento até o posto?\n*1* - Sim, preciso\n*2* - Não, tenho como ir`
    )
  }

  const precisa = deslocamento === "SIM"
  await prisma.coberturaConvite.update({
    where: { id: convite.id },
    data: {
      etapa: "CONCLUIDO",
      precisaDeslocamento: precisa,
      respondidoAt: new Date(),
      respostaTexto: texto || (precisa ? "Precisa de deslocamento" : "Não precisa"),
    },
  })
  await responder(buildConfirmacaoExtraMessage(tratamento, precisa))
  return { tratado: true, acao: "DESLOCAMENTO" }
}
