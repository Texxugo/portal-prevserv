import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

const optionalNullableText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !isNaN(v.getTime()), "Data inválida")

// Endereço estruturado — os mesmos campos no posto e no colaborador, porque é
// o que o painel operacional precisa para virar alfinete no mapa.
const enderecoFields = {
  cep: optionalText.refine(
    (v) => v === null || /^\d{5}-?\d{3}$/.test(v),
    "CEP inválido"
  ),
  logradouro: optionalText,
  numero: optionalText,
  complemento: optionalText,
  bairro: optionalText,
  cidade: optionalText,
  uf: optionalText.refine(
    (v) => v === null || /^[A-Za-z]{2}$/.test(v),
    "UF inválida"
  ),
}

// ---------- RH ----------
export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  empresa: optionalText,
  matricula: optionalText,
  cpf: optionalText,
  phone: optionalText,
  sexo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || v === "M" || v === "F", "Sexo inválido"),
  endereco: optionalText,
  ...enderecoFields,
  departmentId: optionalText,
  status: z.enum(["ATIVO", "INATIVO", "AFASTADO"]),
  escalaId: optionalText,
  escalaInicio: optionalDate,
})

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do departamento"),
})

export const departmentEnderecoSchema = z.object(enderecoFields)

// ---------- Usuários ----------
export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  role: z.enum(["ADMIN", "RH", "GESTOR", "VIEWER"]),
  active: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
})

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  email: z.string().trim().email("E-mail inválido"),
  password: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || v.length >= 6,
      "A senha deve ter ao menos 6 caracteres"
    ),
  role: z.enum(["ADMIN", "RH", "GESTOR", "VIEWER"]),
  active: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
})

// ---------- Escalas (RH) ----------
export const escalaSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da escala"),
  cycleDays: z.string().trim().min(1, "Defina o ciclo da escala"),
})

// ---------- Movimentos (RH) ----------
export const movementSchema = z
  .object({
    employeeId: z.string().trim().min(1, "Selecione o colaborador"),
    type: z.enum(["FALTA", "FERIAS", "CONTRATACAO", "DEMISSAO"]),
    justificada: z
      .string()
      .optional()
      .transform((v) => (v === "true" ? true : v === "false" ? false : null)),
    startDate: z
      .string()
      .trim()
      .min(1, "Informe a data de início")
      .transform((v) => new Date(v))
      .refine((v) => !isNaN(v.getTime()), "Data inválida"),
    endDate: optionalDate,
    note: optionalText,
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "A data fim deve ser igual ou posterior ao início",
    path: ["endDate"],
  })

// ---------- Apontamento (RH) ----------
const toIntOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  return typeof v === "number" ? v : Number(String(v).trim())
}
// inteiro >= 0 opcional (vazio → null)
const optionalInt = z.preprocess(
  toIntOrNull,
  z.number().int("Valor inválido").min(0, "Valor inválido").nullable()
)
// inteiro >= 0 com default 0 (campos sempre presentes)
const baseInt = z.preprocess(
  (v) => toIntOrNull(v) ?? 0,
  z.number().int("Valor inválido").min(0, "Valor inválido")
)
// duração "HH:MM" (horas podem passar de 24) opcional
const optionalDuration = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? null : String(v).trim()),
  z
    .string()
    .regex(/^\d{1,3}:[0-5]\d$/, "Use o formato HH:MM")
    .nullable()
)

export const apontamentoSchema = z.object({
  employeeId: z.string().trim().min(1, "Colaborador inválido"),
  competencia: z.string().trim().regex(/^\d{4}-\d{2}$/, "Competência inválida"),
  total: baseInt,
  valeTransporte: baseInt,
  valeRefeicao: baseInt,
  adicionalNoturno: optionalInt,
  he50: optionalDuration,
  he100: optionalDuration,
  intra: optionalInt,
  faltasE: optionalInt,
  faltasF: optionalInt,
  faltasJust: optionalInt,
  faltasNJust: optionalInt,
  dsr: optionalInt,
  gratPercent: optionalInt,
  recebeCesta: z.boolean(),
  recebeAssiduidade: z.boolean(),
  observacoes: optionalNullableText,
})

// ---------- Pendências documentais (RH) ----------
const requiredDate = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .transform((v) => new Date(v))
    .refine((v) => !isNaN(v.getTime()), "Data inválida")

export const documentoPendenciaSchema = z.object({
  employeeId: z.string().trim().min(1, "Selecione o colaborador"),
  competencia: z.string().trim().regex(/^\d{4}-\d{2}$/, "Competência inválida"),
  documentTypeId: z.string().trim().min(1, "Selecione o tipo de documento"),
  occurrenceId: optionalNullableText,
  reason: z.string().trim().default(""),
  notes: optionalNullableText,
  followUpDate: requiredDate("Informe a data de retorno"),
  alreadyRequested: z.boolean().optional().default(false),
})

export const documentoPendenciaUpdateSchema = z.object({
  documentTypeId: z.string().trim().min(1, "Selecione o tipo de documento"),
  reason: z.string().trim().default(""),
  notes: optionalNullableText,
  followUpDate: requiredDate("Informe a data de retorno"),
})

export const documentoSolicitacaoSchema = z.object({
  message: z.string().trim().min(10, "Revise a mensagem antes de enviar"),
  followUpDate: requiredDate("Informe a próxima data de retorno"),
})

export const documentoRecebimentoSchema = z.object({
  externalUrl: z
    .string()
    .trim()
    .url("Informe um link válido")
    .refine((v) => /^https?:\/\//i.test(v), "O link deve começar com http:// ou https://"),
  notes: optionalNullableText,
})

export const documentoCancelamentoSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo do cancelamento"),
})

export const documentoReaberturaSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo da reabertura"),
  followUpDate: requiredDate("Informe a nova data de retorno"),
})

export const documentoTipoSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do tipo de documento"),
})

// ---------- Efetivos (RH) ----------
export const EFETIVO_EVENTO_SEM_ALTERACAO = "Sem alteração"
export const EFETIVO_EVENTOS = [
  "TT",
  "TI",
  "TE",
  "TP",
  "PI",
  EFETIVO_EVENTO_SEM_ALTERACAO,
] as const

// "AS TE" é alias legado gravado antes da padronização dos eventos
export function normalizeEvento(evento?: string | null) {
  return evento === "AS TE" ? "TE" : evento ?? ""
}

const optionalTime = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Horário inválido")

// Campos que valem para o registro inteiro (e, no cadastro, para o lote todo).
const efetivoBase = z.object({
  departmentId: z.string().trim().min(1, "Posto inválido"),
  date: requiredDate("Informe a data"),
  periodo: z.enum(["DIURNO", "NOTURNO"]),
})

const eventoField = z.enum(EFETIVO_EVENTOS, { message: "Selecione o evento" })

// checkbox nativo manda "on"; as linhas do lote vêm de JSON, já como boolean
const extraField = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true")

const PESSOA_OBRIGATORIA =
  "Selecione o colaborador ou informe o nome do freelancer"

// Edição altera 1 registro → 1 colaborador, com função, horário, evento e extra.
export const efetivoSchema = efetivoBase
  .extend({
    employeeId: optionalText,
    freelancerName: optionalText,
    local: optionalText,
    horario: optionalText,
    horarioEntrada: optionalTime,
    horarioSaida: optionalTime,
    evento: eventoField,
    extra: extraField,
  })
  .superRefine((d, ctx) => {
    if (!d.employeeId && !d.freelancerName) {
      ctx.addIssue({
        code: "custom",
        path: ["employeeId"],
        message: PESSOA_OBRIGATORIA,
      })
    }
  })

// Uma linha do lote: 1 pessoa numa função, com horário, evento e extra próprios.
const efetivoLinhaSchema = z
  .object({
    local: optionalText,
    employeeId: optionalText,
    freelancerName: optionalText,
    horarioEntrada: optionalTime,
    horarioSaida: optionalTime,
    evento: eventoField,
    extra: extraField,
  })
  .superRefine((d, ctx) => {
    if (!d.employeeId && !d.freelancerName) {
      ctx.addIssue({ code: "custom", path: ["employeeId"], message: PESSOA_OBRIGATORIA })
    }
  })

// O form envia as linhas como JSON num campo só (a quantidade é dinâmica).
const linhasJson = z.preprocess((v) => {
  if (typeof v !== "string") return v
  try {
    return JSON.parse(v)
  } catch {
    return []
  }
}, z.array(efetivoLinhaSchema).min(1, "Adicione ao menos um colaborador"))

// Cadastro em lote: 1 Efetivo por linha (+ 1 para a base operacional, se houver).
export const efetivoCreateSchema = efetivoBase
  .extend({
    baseOperacionalId: optionalText,
    linhas: linhasJson,
    temDocumento: z.enum(["sim", "nao"]).optional(),
    documentoUrl: optionalText,
  })
  .superRefine((d, ctx) => {
    // a pergunta de documento vale para o lote: só é exigida se ao menos uma
    // linha tiver evento que gera pendência
    const exigeDocumento = d.linhas.some(
      (l) => l.evento !== EFETIVO_EVENTO_SEM_ALTERACAO
    )
    if (!exigeDocumento) return
    if (!d.temDocumento) {
      ctx.addIssue({
        code: "custom",
        path: ["temDocumento"],
        message: "Informe se existe documento referente ao evento",
      })
    }
    if (d.temDocumento === "sim") {
      if (!d.documentoUrl || !/^https?:\/\//i.test(d.documentoUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["documentoUrl"],
          message: "Informe o link do documento (http:// ou https://)",
        })
      }
    }
  })

// ---------- Tarefas (To-Do / Kanban) ----------
export const TODO_PRIORITIES = ["BAIXA", "MEDIA", "ALTA"] as const
export type TodoPriority = (typeof TODO_PRIORITIES)[number]

export const todoBoardSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do quadro"),
  description: optionalNullableText,
})

export const todoColumnSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da coluna"),
})

export const todoTaskSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da tarefa"),
  description: optionalNullableText,
  assigneeUserId: optionalNullableText,
  dueDate: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? new Date(v) : null))
    .refine((v) => v === null || !isNaN(v.getTime()), "Data inválida"),
  priority: z.enum(TODO_PRIORITIES),
})

// ---------- Relatório diário por posto ----------
// O formulário é grande e dinâmico (linhas de VTR, encomendas, vistorias), então
// ele serializa cada bloco como JSON num campo só — mesmo padrão do lote de efetivos.
const jsonArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v ?? []
    try {
      return JSON.parse(v)
    } catch {
      return []
    }
  }, z.array(item))

// KM aceita "159.008", "159008" ou vazio.
const kmField = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null
    const digits = String(v).replace(/[^\d]/g, "")
    return digits ? Number(digits) : null
  })
  .refine((v) => v === null || Number.isFinite(v), "Quilometragem inválida")

const relatorioVeiculoSchema = z
  .object({
    identificacao: z.string().trim().min(1, "Informe o veículo"),
    placa: z.string().trim().min(1, "Informe a placa"),
    kmInicial: kmField,
    kmFinal: kmField,
    kmProximaTroca: kmField,
  })
  .superRefine((d, ctx) => {
    if (d.kmInicial !== null && d.kmFinal !== null && d.kmFinal < d.kmInicial) {
      ctx.addIssue({
        code: "custom",
        path: ["kmFinal"],
        message: "KM final não pode ser menor que o inicial",
      })
    }
  })

const relatorioEncomendaSchema = z.object({
  destinatario: z.string().trim().min(1, "Informe o destinatário"),
  quadraLote: optionalNullableText,
  codigos: z.string().trim().min(1, "Informe ao menos um código"),
})

const relatorioItemSchema = z.object({
  secao: z.enum(["ESTATISTICA", "PORTARIA"]),
  label: z.string().trim().min(1),
  valor: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null
      const n = Number(String(v).replace(/[^\d-]/g, ""))
      return Number.isFinite(n) ? n : null
    }),
  status: z.enum(["OK", "IRREGULAR", "NAO_APLICA"]).nullish(),
  observacao: optionalNullableText,
})

const relatorioVistoriaSchema = z.object({
  tipo: z.enum(["OBRA", "ESPACO"]),
  titulo: z.string().trim().min(1, "Informe o título da vistoria"),
  quadraLote: optionalNullableText,
  endereco: optionalNullableText,
  proprietario: optionalNullableText,
  responsavel: optionalNullableText,
  situacao: z.enum(["ANDAMENTO", "PARADA"]).nullish(),
  apontamentos: z
    .string()
    .nullish()
    .transform((v) => (v ?? "").trim()),
  observacao: optionalNullableText,
})

const horaField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Horário inválido")

export const relatorioDiarioSchema = z.object({
  departmentId: z.string().trim().min(1, "Posto inválido"),
  date: requiredDate("Informe a data"),
  periodo: z.enum(["DIURNO", "NOTURNO"]),
  responsavel: optionalNullableText,
  encomendasProxTurno: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null
      const n = Number(String(v).replace(/[^\d]/g, ""))
      return Number.isFinite(n) ? n : null
    }),
  horaEncerramento: horaField,
  postoPassadoPara: optionalNullableText,
  observacoes: optionalNullableText,
  mensagem: optionalNullableText,
  veiculos: jsonArray(relatorioVeiculoSchema),
  encomendas: jsonArray(relatorioEncomendaSchema),
  itens: jsonArray(relatorioItemSchema),
  vistorias: jsonArray(relatorioVistoriaSchema),
})

export type RelatorioDiarioInput = z.infer<typeof relatorioDiarioSchema>

// Configuração dos itens de UMA seção do posto. A lista chega inteira e na
// ordem da tela; rótulos repetidos são descartados porque cada item vira um
// campo próprio no formulário (dois "Câmeras" seriam indistinguíveis).
export const relatorioModeloSecaoSchema = z
  .object({
    departmentId: z.string().trim().min(1, "Posto inválido"),
    secao: z.enum(["ESTATISTICA", "PORTARIA"]),
    labels: z.array(z.string().trim().min(1, "Informe o texto do item")),
  })
  .transform((d) => ({
    ...d,
    labels: d.labels.filter(
      (label, i, todos) =>
        todos.findIndex((o) => o.toLowerCase() === label.toLowerCase()) === i
    ),
  }))

// ---------- Painel operacional ----------
export const COBERTURA_MOTIVOS = [
  "FALTA",
  "ATESTADO",
  "FERIAS",
  "AFASTAMENTO",
  "EXTRA",
  "OUTRO",
] as const

export type CoberturaMotivo = (typeof COBERTURA_MOTIVOS)[number]

export const COBERTURA_MOTIVO_LABEL: Record<CoberturaMotivo, string> = {
  FALTA: "Falta",
  ATESTADO: "Atestado",
  FERIAS: "Férias",
  AFASTAMENTO: "Afastamento",
  EXTRA: "Posto extra",
  OUTRO: "Outro",
}

export const coberturaVagaSchema = z.object({
  departmentId: z.string().trim().min(1, "Selecione o posto"),
  date: requiredDate("Informe a data"),
  periodo: z.enum(["DIURNO", "NOTURNO"]),
  horario: optionalText,
  motivo: z.enum(COBERTURA_MOTIVOS),
  observacao: optionalText,
  ausenteId: optionalText,
  origemMovementId: optionalText,
})

export type CoberturaVagaInput = z.infer<typeof coberturaVagaSchema>
