"use server"

import { revalidatePath } from "next/cache"

import { actorName, requireSector, requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import { corrigirMensagem } from "@/lib/gemini"
import { normalizePlaca, kmRodado } from "@/lib/relatorio/calculo"
import {
  extrairCodigo,
  gerarCodigoRelatorio,
  normalizarCodigo,
} from "@/lib/relatorio/codigo"
import { compararTexto, temCorpo, textoCanonico } from "@/lib/relatorio/texto"
import { comRodapeAutenticidade } from "@/lib/whatsapp/templates"
import { sendGroupText } from "@/lib/zapi"
import { relatorioDiarioSchema, relatorioModeloSecaoSchema } from "@/lib/schemas"

type Result = { ok: boolean; error?: string; id?: string }

function refresh(departmentId: string) {
  revalidatePath(`/rh/efetivos/${departmentId}/relatorio`)
  revalidatePath(`/rh/efetivos/${departmentId}`)
  revalidatePath("/rh/relatorios/verificar")
}

export async function saveRelatorioDiario(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireSectorEdit("rh")
  const parsed = relatorioDiarioSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }
  const data = parsed.data

  const department = await prisma.department.findUnique({
    where: { id: data.departmentId },
    select: { id: true },
  })
  if (!department) return { errors: { departmentId: ["Posto não encontrado"] } }

  // Relatório finalizado é imutável: alterá-lo invalidaria o código já divulgado.
  const atual = await prisma.relatorioDiario.findUnique({
    where: {
      departmentId_date_periodo: {
        departmentId: data.departmentId,
        date: data.date,
        periodo: data.periodo,
      },
    },
    select: { status: true },
  })
  if (atual?.status === "FINALIZADO") {
    return {
      errors: {
        _: ["Relatório finalizado. Reabra o relatório para poder alterá-lo."],
      },
    }
  }

  const veiculos = data.veiculos.map((v, ordem) => ({
    identificacao: v.identificacao,
    placa: v.placa.toUpperCase(),
    placaNormalizada: normalizePlaca(v.placa),
    kmInicial: v.kmInicial,
    kmFinal: v.kmFinal,
    kmRodado: kmRodado(v.kmInicial, v.kmFinal),
    kmProximaTroca: v.kmProximaTroca,
    ordem,
  }))

  const encomendas = data.encomendas.map((e, ordem) => ({
    destinatario: e.destinatario,
    quadraLote: e.quadraLote,
    codigos: e.codigos,
    ordem,
  }))

  // Itens em branco não viram linha: o relatório guarda só o que foi preenchido.
  const itens = data.itens
    .map((i, ordem) => ({ ...i, ordem }))
    .filter(
      (i) =>
        i.valor !== null ||
        (i.status !== null && i.status !== undefined) ||
        !!i.observacao
    )
    .map((i) => ({
      secao: i.secao,
      label: i.label,
      ordem: i.ordem,
      valor: i.valor,
      status: i.status ?? null,
      observacao: i.observacao,
    }))

  const vistorias = data.vistorias.map((v, ordem) => ({
    tipo: v.tipo,
    titulo: v.titulo,
    quadraLote: v.quadraLote,
    endereco: v.endereco,
    proprietario: v.proprietario,
    responsavel: v.responsavel,
    situacao: v.situacao ?? null,
    apontamentos: v.apontamentos,
    observacao: v.observacao,
    ordem,
  }))

  const campos = {
    responsavel: data.responsavel,
    encomendasProxTurno: data.encomendasProxTurno,
    horaEncerramento: data.horaEncerramento,
    postoPassadoPara: data.postoPassadoPara,
    observacoes: data.observacoes,
    mensagem: data.mensagem,
  }

  const filhos = {
    veiculos: { create: veiculos },
    encomendas: { create: encomendas },
    itens: { create: itens },
    vistorias: { create: vistorias },
  }

  // O formulário manda o relatório inteiro: os filhos são recriados do zero em
  // vez de reconciliados linha a linha (nenhum outro registro os referencia).
  const chave = {
    departmentId_date_periodo: {
      departmentId: data.departmentId,
      date: data.date,
      periodo: data.periodo,
    },
  }

  await prisma.$transaction(async (tx) => {
    const existente = await tx.relatorioDiario.findUnique({
      where: chave,
      select: { id: true },
    })
    if (existente) {
      await Promise.all([
        tx.relatorioVeiculo.deleteMany({ where: { relatorioId: existente.id } }),
        tx.relatorioEncomenda.deleteMany({ where: { relatorioId: existente.id } }),
        tx.relatorioItem.deleteMany({ where: { relatorioId: existente.id } }),
        tx.relatorioVistoria.deleteMany({ where: { relatorioId: existente.id } }),
      ])
      return tx.relatorioDiario.update({
        where: { id: existente.id },
        data: { ...campos, ...filhos },
        select: { id: true },
      })
    }
    return tx.relatorioDiario.create({
      data: {
        departmentId: data.departmentId,
        date: data.date,
        periodo: data.periodo,
        ...campos,
        ...filhos,
        createdById: user.id,
        createdByName: actorName(user),
      },
      select: { id: true },
    })
  })

  refresh(data.departmentId)
  return { message: "Relatório salvo." }
}

export async function deleteRelatorioDiario(id: string): Promise<Result> {
  await requireSectorEdit("rh")
  const relatorio = await prisma.relatorioDiario.delete({ where: { id } })
  refresh(relatorio.departmentId)
  return { ok: true }
}

// KM inicial sugerido: último KM final registrado para a mesma placa no posto,
// em relatório anterior à data/turno que está sendo preenchido.
export async function kmAnteriorPorPlaca(
  departmentId: string,
  placa: string,
  date: string,
  periodo: string
): Promise<{ kmFinal: number | null; kmProximaTroca: number | null }> {
  await requireSectorEdit("rh")
  const normalizada = normalizePlaca(placa)
  if (!normalizada) return { kmFinal: null, kmProximaTroca: null }

  const alvo = new Date(date)
  // No mesmo dia o turno diurno antecede o noturno, então ele também conta
  // como "relatório anterior" quando se está preenchendo o noturno.
  const mesmoDiaAnterior =
    periodo === "NOTURNO" ? [{ date: alvo, periodo: "DIURNO" }] : []

  const anterior = await prisma.relatorioVeiculo.findFirst({
    where: {
      placaNormalizada: normalizada,
      relatorio: {
        departmentId,
        OR: [{ date: { lt: alvo } }, ...mesmoDiaAnterior],
      },
    },
    orderBy: [{ relatorio: { date: "desc" } }, { relatorio: { periodo: "desc" } }],
    select: { kmFinal: true, kmProximaTroca: true },
  })

  return {
    kmFinal: anterior?.kmFinal ?? null,
    kmProximaTroca: anterior?.kmProximaTroca ?? null,
  }
}

export async function corrigirTextoRelatorio(
  text: string
): Promise<{ ok: boolean; text?: string; error?: string }> {
  await requireSectorEdit("rh")
  if (text.trim().length < 5) {
    return { ok: false, error: "Escreva o texto antes de corrigir." }
  }
  return corrigirMensagem(text, "relatorio")
}

// Salva os itens de UMA seção do posto (a outra fica intacta). A lista chega
// inteira e na ordem da tela — é ela que define quais campos o posto preenche
// daqui para frente.
export async function saveRelatorioModeloSecao(
  departmentId: string,
  secao: string,
  labels: string[]
): Promise<Result> {
  await requireSectorEdit("rh")
  const parsed = relatorioModeloSecaoSchema.safeParse({
    departmentId,
    secao,
    labels,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }
  const data = parsed.data

  await prisma.$transaction(async (tx) => {
    await tx.relatorioModeloItem.deleteMany({
      where: { departmentId: data.departmentId, secao: data.secao },
    })
    if (data.labels.length) {
      await tx.relatorioModeloItem.createMany({
        data: data.labels.map((label, ordem) => ({
          departmentId: data.departmentId,
          secao: data.secao,
          label,
          ordem,
        })),
      })
    }
  })

  refresh(data.departmentId)
  return { ok: true }
}

// ---------- rastreabilidade ----------

// Monta o texto que sai para o grupo: corpo gravado (ou reescrito à mão) mais o
// rodapé de autenticidade.
async function textoParaEnvio(id: string) {
  const r = await prisma.relatorioDiario.findUnique({
    where: { id },
    include: {
      department: { select: { name: true, whatsappGrupoId: true } },
      veiculos: { orderBy: { ordem: "asc" } },
      encomendas: { orderBy: { ordem: "asc" } },
      itens: { orderBy: { ordem: "asc" } },
      vistorias: { orderBy: { ordem: "asc" } },
    },
  })
  if (!r) return null

  const corpo = textoCanonico({
    mensagem: r.mensagem,
    posto: r.department.name,
    date: r.date,
    periodo: r.periodo,
    responsavel: r.responsavel,
    encomendasProxTurno: r.encomendasProxTurno,
    horaEncerramento: r.horaEncerramento,
    postoPassadoPara: r.postoPassadoPara,
    observacoes: r.observacoes,
    veiculos: r.veiculos,
    encomendas: r.encomendas,
    estatisticas: r.itens.filter((i) => i.secao === "ESTATISTICA"),
    portaria: r.itens.filter((i) => i.secao === "PORTARIA"),
    vistorias: r.vistorias,
  })

  return {
    departmentId: r.departmentId,
    grupoId: r.department.whatsappGrupoId,
    status: r.status,
    texto: comRodapeAutenticidade(corpo, r.codigo),
  }
}

export type EnvioResult = {
  enviado: boolean
  semGrupo?: boolean
  erro?: string
}

// Dispara o relatório no grupo do posto e grava o resultado da tentativa.
// A falha NÃO derruba o fechamento: o relatório continua finalizado e válido,
// e a tela oferece reenviar — perder o fechamento por instabilidade da Z-API
// seria pior do que ficar com o envio pendente.
async function enviarAoGrupo(id: string): Promise<EnvioResult> {
  const dados = await textoParaEnvio(id)
  if (!dados) return { enviado: false, erro: "Relatório não encontrado." }
  if (!dados.grupoId) return { enviado: false, semGrupo: true }

  const result = await sendGroupText(dados.grupoId, dados.texto)

  await prisma.relatorioDiario.update({
    where: { id },
    data: {
      enviadoAt: result.ok ? new Date() : null,
      enviadoMessageId: result.ok ? (result.messageId ?? null) : null,
      enviadoErro: result.ok ? null : (result.error ?? "Falha ao enviar"),
    },
  })

  return result.ok
    ? { enviado: true }
    : { enviado: false, erro: result.error ?? "Falha ao enviar" }
}

// Reenvio manual, para quando o disparo do fechamento falhou.
export async function reenviarRelatorioAoGrupo(
  id: string
): Promise<Result & { envio?: EnvioResult }> {
  await requireSectorEdit("rh")
  const dados = await textoParaEnvio(id)
  if (!dados) return { ok: false, error: "Relatório não encontrado." }
  if (dados.status !== "FINALIZADO") {
    return { ok: false, error: "Finalize o relatório antes de enviar." }
  }

  const envio = await enviarAoGrupo(id)
  refresh(dados.departmentId)
  if (envio.semGrupo) {
    return { ok: false, error: "Este posto não tem grupo de WhatsApp cadastrado." }
  }
  return envio.enviado ? { ok: true } : { ok: false, error: envio.erro }
}

// Fecha o relatório, emite o código de autenticidade e envia ao grupo do posto.
// O código é sorteado de novo a cada fechamento: um relatório reaberto e
// reeditado nunca reaproveita o código anterior, então texto antigo não valida.
export async function finalizarRelatorio(
  id: string
): Promise<Result & { envio?: EnvioResult }> {
  const user = await requireSectorEdit("rh")

  const relatorio = await prisma.relatorioDiario.findUnique({
    where: { id },
    select: {
      id: true,
      departmentId: true,
      status: true,
      date: true,
      periodo: true,
    },
  })
  if (!relatorio) return { ok: false, error: "Relatório não encontrado." }
  if (relatorio.status === "FINALIZADO") {
    return { ok: false, error: "Este relatório já está finalizado." }
  }

  // O código é único no banco; colisão é improvável, mas o retry evita que um
  // sorteio azarado derrube o fechamento na cara do usuário. O filtro por
  // status no updateMany impede que dois fechamentos simultâneos emitam dois
  // códigos para o mesmo relatório.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoRelatorio(relatorio.date, relatorio.periodo)
    const gravou = await prisma.relatorioDiario
      .updateMany({
        where: { id, status: "RASCUNHO" },
        data: {
          codigo,
          status: "FINALIZADO",
          finalizadoAt: new Date(),
          finalizadoPorNome: actorName(user),
        },
      })
      .catch(() => null)
    if (gravou === null) continue // colisão de código — sorteia outro
    if (gravou.count === 0) {
      return { ok: false, error: "Este relatório já está finalizado." }
    }
    // o envio acontece depois do código gravado, para o texto já sair com ele
    const envio = await enviarAoGrupo(id)
    refresh(relatorio.departmentId)
    return { ok: true, id: codigo, envio }
  }
  return { ok: false, error: "Não foi possível gerar o código. Tente de novo." }
}

// Reabrir apaga o código: enquanto o relatório estiver em rascunho não existe
// código válido para ele, e o próximo fechamento emite outro.
export async function reabrirRelatorio(id: string): Promise<Result> {
  await requireSectorEdit("rh")
  const relatorio = await prisma.relatorioDiario.update({
    where: { id },
    data: {
      status: "RASCUNHO",
      codigo: null,
      finalizadoAt: null,
      finalizadoPorNome: null,
      // o que foi enviado ao grupo carregava o código antigo; o registro de
      // envio deixa de valer junto com ele
      enviadoAt: null,
      enviadoMessageId: null,
      enviadoErro: null,
    },
    select: { departmentId: true },
  })
  refresh(relatorio.departmentId)
  return { ok: true }
}

export type ResultadoVerificacao =
  | "NAO_ENCONTRADO"
  | "CODIGO_APENAS"
  | "INTEGRO"
  | "ALTERADO"

export type VerificacaoRelatorio = {
  resultado: ResultadoVerificacao
  codigo: string
  posto: string
  date: Date
  periodo: string
  responsavel: string | null
  finalizadoAt: Date | null
  finalizadoPorNome: string | null
  criadoPorNome: string
  // divergências entre o texto apresentado e o relatório gravado
  faltando: string[]
  acrescentadas: string[]
  // quantas vezes este mesmo código já foi conferido antes desta consulta
  consultasAnteriores: number
  efetivos: {
    pessoa: string
    freelancer: boolean
    local: string | null
    horario: string | null
  }[]
}

// Confere um relatório apresentado por terceiro. Aceita tanto o código digitado
// quanto a MENSAGEM INTEIRA colada do WhatsApp — colando, dá para dizer se o
// texto ainda é o que foi emitido ou se foi mexido depois.
// Toda consulta é registrada: é o log que denuncia código reaproveitado.
export async function verificarCodigoRelatorio(
  entrada: string
): Promise<{ ok: boolean; error?: string; relatorio?: VerificacaoRelatorio }> {
  const user = await requireSector("rh")

  // aceita a mensagem colada (extrai o código de dentro) ou o código solto
  const normalizado = extrairCodigo(entrada) || normalizarCodigo(entrada)
  if (!normalizado) {
    return {
      ok: false,
      error:
        "Não encontrei um código no que você enviou. Cole a mensagem inteira ou digite os 10 caracteres do código.",
    }
  }

  const relatorio = await prisma.relatorioDiario.findUnique({
    where: { codigo: normalizado },
    include: {
      department: { select: { name: true } },
      veiculos: { orderBy: { ordem: "asc" } },
      encomendas: { orderBy: { ordem: "asc" } },
      itens: { orderBy: { ordem: "asc" } },
      vistorias: { orderBy: { ordem: "asc" } },
    },
  })

  if (!relatorio?.codigo) {
    await prisma.relatorioVerificacao.create({
      data: {
        codigo: normalizado,
        resultado: "NAO_ENCONTRADO",
        actorName: actorName(user),
      },
    })
    return {
      ok: false,
      error:
        "Nenhum relatório finalizado com este código. Ou o texto não saiu do sistema, ou o relatório foi reaberto depois de enviado.",
    }
  }

  const gravado = textoCanonico({
    mensagem: relatorio.mensagem,
    posto: relatorio.department.name,
    date: relatorio.date,
    periodo: relatorio.periodo,
    responsavel: relatorio.responsavel,
    encomendasProxTurno: relatorio.encomendasProxTurno,
    horaEncerramento: relatorio.horaEncerramento,
    postoPassadoPara: relatorio.postoPassadoPara,
    observacoes: relatorio.observacoes,
    veiculos: relatorio.veiculos,
    encomendas: relatorio.encomendas,
    estatisticas: relatorio.itens.filter((i) => i.secao === "ESTATISTICA"),
    portaria: relatorio.itens.filter((i) => i.secao === "PORTARIA"),
    vistorias: relatorio.vistorias,
  })

  // Só dá para atestar integridade se veio texto junto; código solto responde
  // apenas "este código existe".
  const comparacao = temCorpo(entrada, normalizado)
    ? compararTexto(entrada, gravado)
    : null
  const resultado: ResultadoVerificacao = !comparacao
    ? "CODIGO_APENAS"
    : comparacao.igual
      ? "INTEGRO"
      : "ALTERADO"

  const [consultasAnteriores, efetivos] = await Promise.all([
    prisma.relatorioVerificacao.count({ where: { codigo: normalizado } }),
    prisma.efetivo.findMany({
      where: {
        departmentId: relatorio.departmentId,
        date: relatorio.date,
        periodo: relatorio.periodo,
      },
      select: {
        freelancerName: true,
        employeeId: true,
        local: true,
        horario: true,
        employee: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ])

  await prisma.relatorioVerificacao.create({
    data: {
      codigo: normalizado,
      resultado,
      relatorioId: relatorio.id,
      actorName: actorName(user),
    },
  })

  return {
    ok: true,
    relatorio: {
      resultado,
      codigo: relatorio.codigo,
      posto: relatorio.department.name,
      date: relatorio.date,
      periodo: relatorio.periodo,
      responsavel: relatorio.responsavel,
      finalizadoAt: relatorio.finalizadoAt,
      finalizadoPorNome: relatorio.finalizadoPorNome,
      criadoPorNome: relatorio.createdByName,
      faltando: comparacao?.faltando ?? [],
      acrescentadas: comparacao?.acrescentadas ?? [],
      consultasAnteriores,
      efetivos: efetivos.map((e) => ({
        pessoa: e.employee?.name ?? e.freelancerName ?? "—",
        freelancer: !e.employeeId,
        local: e.local,
        horario: e.horario,
      })),
    },
  }
}
