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

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "E-mail inválido"
  )

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !isNaN(v.getTime()), "Data inválida")

// Aceita formato BR ("1.234,56") e JS ("1234.56")
function parseDecimal(raw: string): number {
  const s = raw.trim()
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."))
  return Number(s)
}

const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? parseDecimal(v) : null))
  .refine((v) => v === null || (!isNaN(v) && v >= 0), "Valor inválido")

// ---------- RH ----------
export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  matricula: optionalText,
  cpf: optionalText,
  email: optionalEmail,
  phone: optionalText,
  position: optionalText,
  departmentId: optionalText,
  admissionDate: optionalDate,
  salary: optionalNumber,
  status: z.enum(["ATIVO", "INATIVO", "AFASTADO"]),
  workSchedule: optionalText,
  escalaId: optionalText,
  escalaInicio: optionalDate,
})

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do departamento"),
})

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

const optionalTime = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Horário inválido")

const efetivoBase = z.object({
  employeeId: optionalText,
  freelancerName: optionalText,
  departmentId: z.string().trim().min(1, "Posto inválido"),
  date: requiredDate("Informe a data"),
  horario: optionalText,
  horarioEntrada: optionalTime,
  horarioSaida: optionalTime,
  local: optionalText,
  evento: z.enum(EFETIVO_EVENTOS, { message: "Selecione o evento" }),
  periodo: z.enum(["DIURNO", "NOTURNO"]),
  // checkbox nativo: "on" quando marcado, ausente quando não
  extra: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
})

const pessoaRefine = (
  d: { employeeId: string | null; freelancerName: string | null },
  ctx: z.RefinementCtx
) => {
  if (!d.employeeId && !d.freelancerName) {
    ctx.addIssue({
      code: "custom",
      path: ["employeeId"],
      message: "Selecione o colaborador ou informe o nome do freelancer",
    })
  }
}

export const efetivoSchema = efetivoBase.superRefine(pessoaRefine)

export const efetivoCreateSchema = efetivoBase
  .extend({
    temDocumento: z.enum(["sim", "nao"]).optional(),
    documentoUrl: optionalText,
  })
  .superRefine(pessoaRefine)
  .superRefine((d, ctx) => {
    if (d.evento === EFETIVO_EVENTO_SEM_ALTERACAO) return
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
