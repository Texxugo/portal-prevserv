// Pipeline de importação do espelho: parse → período → casamento → merge → detecção.
// Puro (sem Prisma, sem sessão) e único: as telas de Espelhos e de Encerramento e o
// reprocessamento passam por aqui, em vez de manter cada uma a sua cópia das regras de
// janela. Quem persiste é lib/actions/fechamento.ts.

import { competenciaFromDate, competenciaRange } from "@/lib/competencia"
import { normNome, type EmployeeIndex } from "@/lib/employee-match"
import {
  buildDayResolver,
  hasResolverSchedule,
  type ScheduleSource,
} from "@/lib/jornada"
import { detectarOcorrencias, type Ocorrencia } from "./detectar-fechamento"
import { type EspelhoColaborador, type EspelhoDia } from "./parse-qyon"
import { aplicarVirada } from "./virada"

export type EmployeeBase = ScheduleSource & {
  id: string
  name: string
  matricula: string | null
}

// ---------------------------------------------------------------- período do arquivo

export type PeriodoArquivo = {
  inicio: Date
  fim: Date
  // Competências (21→20) tocadas pelas datas do arquivo. Mais de uma = arquivo que
  // atravessa o dia 20; o import recusa, porque metade das batidas iria para o mês errado.
  competencias: string[]
}

export function analisarPeriodo(
  colaboradores: EspelhoColaborador[]
): PeriodoArquivo | null {
  let inicio: Date | null = null
  let fim: Date | null = null
  const competencias = new Set<string>()

  for (const c of colaboradores) {
    for (const d of c.dias) {
      if (!inicio || d.data.getTime() < inicio.getTime()) inicio = d.data
      if (!fim || d.data.getTime() > fim.getTime()) fim = d.data
      competencias.add(competenciaFromDate(d.data))
    }
  }

  if (!inicio || !fim) return null
  return { inicio, fim, competencias: [...competencias].sort() }
}

// ---------------------------------------------------------------- identidade / pendência

export type PendenciaTipo = "NAO_ENCONTRADO" | "AMBIGUO" | "SEM_JORNADA"

// Identidade da linha do arquivo. Inclui a empresa porque a matrícula do Qyon só é
// única dentro dela.
export function identidadeDe(c: {
  empresa: string | null
  matricula: string
  nome: string
}): string {
  return `${c.empresa ?? ""}|${c.matricula.trim()}|${normNome(c.nome)}`
}

export function chavePendencia(tipo: PendenciaTipo, identidade: string): string {
  return `${tipo}:${identidade}`
}

export type ImportPendencia = {
  tipo: PendenciaTipo
  chave: string
  identidade: string
  nome: string
  matricula: string | null
  empresa: string | null
  employeeId: string | null
  dias: EspelhoDia[]
}

// ---------------------------------------------------------------- carry de justificativa

export type OcorrenciaGravada = {
  data: Date
  tipo: string
  justificativaCategoria: string | null
  justificativaObs: string | null
  resolvido: boolean
}

export type OcorrenciaPlanejada = Ocorrencia & {
  justificativaCategoria: string | null
  justificativaObs: string | null
  resolvido: boolean
}

type CarryMap = Map<
  string,
  { cat: string | null; obs: string | null; resolvido: boolean }
>

function carryKey(data: Date, tipo: string): string {
  return `${data.toISOString()}|${tipo}`
}

function buildCarry(ocorrencias: OcorrenciaGravada[]): CarryMap {
  const map: CarryMap = new Map()
  for (const o of ocorrencias) {
    map.set(carryKey(o.data, o.tipo), {
      cat: o.justificativaCategoria,
      obs: o.justificativaObs,
      resolvido: o.resolvido,
    })
  }
  return map
}

// A ocorrência é recriada a cada import; a justificativa já dada sobrevive pela chave
// data+tipo.
function comCarry(ocorr: Ocorrencia[], carry: CarryMap): OcorrenciaPlanejada[] {
  return ocorr.map((o) => {
    const carried = carry.get(carryKey(o.data, o.tipo))
    return {
      ...o,
      justificativaCategoria: carried?.cat ?? null,
      justificativaObs: carried?.obs ?? null,
      resolvido: carried?.resolvido ?? false,
    }
  })
}

// ---------------------------------------------------------------- detecção

export type Janela = { inicio: Date; fim: Date }

// Detecção de um colaborador dentro de uma janela. Único lugar que amarra virada +
// detectarOcorrencias — usado pelo import, pelo reprocessamento e pelo preview.
export function detectarDoColaborador(input: {
  emp: ScheduleSource
  dias: EspelhoDia[]
  competencia: string
  tolerancia: number
  tiposAtivos: Set<string>
  janela: Janela
}): Ocorrencia[] {
  const resolver = buildDayResolver(input.emp)
  const dias = aplicarVirada(input.dias, resolver, input.janela.inicio)
  return detectarOcorrencias(
    dias,
    resolver,
    input.tolerancia,
    input.competencia,
    input.tiposAtivos,
    undefined,
    input.janela.fim,
    input.janela.inicio
  )
}

// ---------------------------------------------------------------- fechamentos gravados

export type FechamentoExistente<T> = {
  id: string
  employeeId: string
  status: string
  employee: T
  dias: { data: Date; marcacoes: string }[]
  ocorrencias: OcorrenciaGravada[]
}

export function rawToDias(rows: { data: Date; marcacoes: string }[]): EspelhoDia[] {
  return rows.map((d) => ({
    data: d.data,
    marcacoes: d.marcacoes.split(" ").filter(Boolean),
  }))
}

export type Recomputado<T> = {
  fechamento: FechamentoExistente<T>
  ocorr: OcorrenciaPlanejada[]
}

// Recalcula ocorrências a partir das batidas já gravadas. Base do reprocessamento e da
// "extensão de janela" (quem não veio no arquivo novo mas passa a ter dias cobertos).
export function recomputarFechamentos<T extends EmployeeBase>(input: {
  fechamentos: FechamentoExistente<T>[]
  competencia: string
  tolerancia: number
  tiposAtivos: Set<string>
  janela: Janela
}): { recalculados: Recomputado<T>[]; semDados: number } {
  const recalculados: Recomputado<T>[] = []
  let semDados = 0

  for (const f of input.fechamentos) {
    // Importado antes das batidas cruas existirem, ou sem jornada: nada a recomputar.
    if (f.dias.length === 0 || !hasResolverSchedule(f.employee)) {
      semDados++
      continue
    }
    const ocorr = detectarDoColaborador({
      emp: f.employee,
      dias: rawToDias(f.dias),
      competencia: input.competencia,
      tolerancia: input.tolerancia,
      tiposAtivos: input.tiposAtivos,
      janela: input.janela,
    })
    recalculados.push({ fechamento: f, ocorr: comCarry(ocorr, buildCarry(f.ocorrencias)) })
  }

  return { recalculados, semDados }
}

// Janela acumulada da competência: menor/maior data entre TODAS as batidas conhecidas.
// É global de propósito — quem faltou os últimos dias precisa continuar gerando falta,
// e é ela que diz se o mês já foi coberto até o dia 20.
export function janelaAcumulada(
  competencia: string,
  grupos: Iterable<{ data: Date }[]>
): Janela | null {
  let inicio: Date | null = null
  let fim: Date | null = null
  for (const dias of grupos) {
    for (const d of dias) {
      if (!inicio || d.data.getTime() < inicio.getTime()) inicio = d.data
      if (!fim || d.data.getTime() > fim.getTime()) fim = d.data
    }
  }
  if (!inicio || !fim) return null

  // A detecção nunca começa antes do dia 21: fora do período não existe competência.
  const rangeStart = competenciaRange(competencia).start
  return {
    inicio: inicio.getTime() > rangeStart.getTime() ? inicio : rangeStart,
    fim,
  }
}

// ---------------------------------------------------------------- plano de import

export type ProcColaborador<T> = {
  emp: T
  // Batidas acumuladas: as gravadas fora da janela do arquivo + as do arquivo.
  merged: EspelhoDia[]
  ocorr: OcorrenciaPlanejada[]
}

export type PlanoImport<T> = {
  procs: ProcColaborador<T>[]
  estendidos: Recomputado<T>[]
  pendencias: ImportPendencia[]
  encerradosPulados: number
  janela: Janela
}

export function planejarImport<T extends EmployeeBase>(input: {
  colaboradores: EspelhoColaborador[]
  index: EmployeeIndex<T>
  // Vínculos já resolvidos na fila de pendências: identidade do arquivo → cadastro.
  vinculos: Map<string, T>
  existentes: FechamentoExistente<T>[]
  competencia: string
  tolerancia: number
  tiposAtivos: Set<string>
  janelaArquivo: Janela
  // Curadoria do preview: quando presente, só estas matrículas entram.
  incluir?: Set<string>
}): PlanoImport<T> {
  const existingByEmp = new Map(input.existentes.map((f) => [f.employeeId, f]))

  type Parcial = { emp: T; merged: EspelhoDia[] }
  // Chaveado por employeeId: duas linhas do arquivo podem casar com o MESMO cadastro
  // (matrícula reusada entre empresas). Sem isso, o createMany estoura a unique
  // (employeeId, competencia).
  const porEmp = new Map<string, Parcial>()
  const pendPorChave = new Map<string, ImportPendencia>()
  let encerradosPulados = 0

  const registrarPendencia = (
    tipo: PendenciaTipo,
    c: EspelhoColaborador,
    employeeId: string | null
  ) => {
    const identidade = identidadeDe(c)
    const chave = chavePendencia(tipo, identidade)
    const atual = pendPorChave.get(chave)
    if (atual) {
      atual.dias = [...atual.dias, ...c.dias]
      return
    }
    pendPorChave.set(chave, {
      tipo,
      chave,
      identidade,
      nome: c.nome,
      matricula: c.matricula.trim() || null,
      empresa: c.empresa,
      employeeId,
      dias: [...c.dias],
    })
  }

  // 1ª passada: casa e mescla as batidas do arquivo com as já gravadas (import
  // incremental — arquivo 30→04 soma ao 21→29 importado antes; dentro da janela do
  // arquivo, o arquivo novo vence).
  for (const c of input.colaboradores) {
    const mat = c.matricula.trim()
    if (
      input.incluir &&
      input.incluir.size > 0 &&
      !input.incluir.has(mat) &&
      !input.incluir.has(mat.replace(/^0+/, ""))
    ) {
      continue
    }

    // O vínculo resolvido na fila vence o índice: foi uma pessoa que decidiu.
    const vinculado = input.vinculos.get(identidadeDe(c))
    const match = vinculado
      ? { employee: vinculado, ambiguo: false }
      : input.index.findDetalhado(mat, c.nome)

    if (!match.employee) {
      registrarPendencia(match.ambiguo ? "AMBIGUO" : "NAO_ENCONTRADO", c, null)
      continue
    }
    const emp = match.employee
    if (!hasResolverSchedule(emp)) {
      registrarPendencia("SEM_JORNADA", c, emp.id)
      continue
    }

    const jaVisto = porEmp.get(emp.id)
    if (jaVisto) {
      jaVisto.merged = [...jaVisto.merged, ...c.dias]
      continue
    }

    const existente = existingByEmp.get(emp.id)
    if (existente?.status === "ENCERRADO") {
      encerradosPulados++
      continue
    }

    const foraJanela = existente
      ? rawToDias(existente.dias).filter(
          (d) =>
            d.data.getTime() < input.janelaArquivo.inicio.getTime() ||
            d.data.getTime() > input.janelaArquivo.fim.getTime()
        )
      : []

    porEmp.set(emp.id, { emp, merged: [...foraJanela, ...c.dias] })
  }

  const parciais = [...porEmp.values()]

  // Janela acumulada global: tudo que já existe na competência + o arquivo atual.
  const janela =
    janelaAcumulada(input.competencia, [
      ...parciais.map((p) => p.merged),
      ...input.existentes.map((f) => f.dias),
    ]) ?? input.janelaArquivo

  // 2ª passada: virada + detecção sobre o acumulado.
  const procs: ProcColaborador<T>[] = parciais.map((p) => {
    const existente = existingByEmp.get(p.emp.id)
    const ocorr = detectarDoColaborador({
      emp: p.emp,
      dias: p.merged,
      competencia: input.competencia,
      tolerancia: input.tolerancia,
      tiposAtivos: input.tiposAtivos,
      janela,
    })
    return {
      emp: p.emp,
      merged: p.merged,
      ocorr: comCarry(ocorr, buildCarry(existente?.ocorrencias ?? [])),
    }
  })

  // Fechamentos da competência que NÃO vieram no arquivo (o relatório só lista quem
  // bateu): a janela acumulada cresceu, então a detecção roda de novo para eles — é
  // assim que a falta do período novo aparece.
  const processados = new Set(procs.map((p) => p.emp.id))
  const { recalculados } = recomputarFechamentos({
    fechamentos: input.existentes.filter(
      (f) => !processados.has(f.employeeId) && f.status !== "ENCERRADO"
    ),
    competencia: input.competencia,
    tolerancia: input.tolerancia,
    tiposAtivos: input.tiposAtivos,
    janela,
  })

  return {
    procs,
    estendidos: recalculados,
    pendencias: [...pendPorChave.values()],
    encerradosPulados,
    janela,
  }
}

// ---------------------------------------------------------------- batidas represadas

// As batidas de uma pendência ficam guardadas em JSON até alguém resolver a fila —
// assim resolver não exige o TXT de novo.
export function serializarDias(dias: EspelhoDia[]): string {
  const byDay = new Map<string, EspelhoDia>()
  for (const d of dias) byDay.set(d.data.toISOString(), d)
  return JSON.stringify(
    [...byDay.values()]
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .map((d) => ({ data: d.data.toISOString(), marcacoes: d.marcacoes }))
  )
}

export function desserializarDias(json: string): EspelhoDia[] {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((d) => d && typeof d.data === "string")
      .map((d) => ({
        data: new Date(d.data),
        marcacoes: Array.isArray(d.marcacoes) ? d.marcacoes : [],
      }))
  } catch {
    return []
  }
}

// A pendência guarda a chave "TIPO:identidade"; o vínculo é gravado só pela identidade,
// porque ele vale para qualquer tipo de pendência e para as próximas competências.
export function identidadeDaChave(chave: string): string {
  const i = chave.indexOf(":")
  return i < 0 ? chave : chave.slice(i + 1)
}
