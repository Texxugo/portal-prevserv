import { Role } from "@prisma/client"

// Módulo = uma área do sistema que se libera ou se nega por usuário. A chave é
// gravada em UserModulo.modulo, então renomear uma chave exige migração.
export const MODULO_KEYS = [
  "EFETIVOS",
  "RELATORIOS",
  "COLABORADORES",
  "DEPARTAMENTOS",
  "ESCALAS",
  "MOVIMENTOS",
  "APONTAMENTO",
  "ESPELHOS",
  "FECHAMENTO",
  "PENDENCIAS",
  "TAREFAS",
  "USUARIOS",
] as const

export type ModuloKey = (typeof MODULO_KEYS)[number]

export type ModuloDef = {
  key: ModuloKey
  label: string
  descricao: string
  grupo: "Operação" | "RH" | "Administração"
  // Módulo cujos dados são de um posto: quem não tem o posto no escopo não vê
  // o registro, mesmo tendo o módulo liberado.
  porPosto: boolean
  // Rótulo do que a permissão de edição destrava neste módulo.
  edicaoLabel: string
}

export const MODULOS: ModuloDef[] = [
  {
    key: "EFETIVOS",
    label: "Efetivos",
    descricao: "Efetivo diário do posto e ausências de cadastro.",
    grupo: "Operação",
    porPosto: true,
    edicaoLabel: "Lançar e conferir efetivo",
  },
  {
    key: "RELATORIOS",
    label: "Relatório diário",
    descricao: "Cadastro do relatório do posto, painel do dia e verificação de código.",
    grupo: "Operação",
    porPosto: true,
    edicaoLabel: "Preencher e finalizar relatório",
  },
  {
    key: "TAREFAS",
    label: "Tarefas",
    descricao: "Quadros de tarefas compartilhados.",
    grupo: "Operação",
    porPosto: false,
    edicaoLabel: "Criar e mover tarefas",
  },
  {
    key: "COLABORADORES",
    label: "Colaboradores",
    descricao: "Cadastro de funcionários, importação e salários.",
    grupo: "RH",
    porPosto: true,
    edicaoLabel: "Cadastrar, editar e ver salário",
  },
  {
    key: "ESCALAS",
    label: "Escalas",
    descricao: "Escalas de trabalho e jornadas.",
    grupo: "RH",
    porPosto: false,
    edicaoLabel: "Criar e alterar escalas",
  },
  {
    key: "MOVIMENTOS",
    label: "Movimentos",
    descricao: "Férias, afastamentos e demais movimentos.",
    grupo: "RH",
    porPosto: true,
    edicaoLabel: "Lançar movimentos",
  },
  {
    key: "APONTAMENTO",
    label: "Apontamento",
    descricao: "Fechamento para a folha e relatório de apontamento.",
    grupo: "RH",
    porPosto: false,
    edicaoLabel: "Lançar apontamento",
  },
  {
    key: "ESPELHOS",
    label: "Espelhos de ponto",
    descricao: "Importação e consulta dos espelhos do Qyon.",
    grupo: "RH",
    porPosto: false,
    edicaoLabel: "Importar espelhos",
  },
  {
    key: "FECHAMENTO",
    label: "Encerramento de espelho",
    descricao: "Tratativa de ocorrências e encerramento da competência.",
    grupo: "RH",
    porPosto: false,
    edicaoLabel: "Justificar e encerrar",
  },
  {
    key: "PENDENCIAS",
    label: "Pendências documentais",
    descricao: "Cobrança de documentos e notificações.",
    grupo: "RH",
    porPosto: false,
    edicaoLabel: "Criar e baixar pendências",
  },
  {
    key: "DEPARTAMENTOS",
    label: "Departamentos",
    descricao: "Cadastro dos postos e grupos de WhatsApp.",
    grupo: "Administração",
    porPosto: false,
    edicaoLabel: "Criar e alterar postos",
  },
  {
    key: "USUARIOS",
    label: "Usuários e permissões",
    descricao: "Acessos da plataforma e o que cada um enxerga.",
    grupo: "Administração",
    porPosto: false,
    edicaoLabel: "Criar usuários e alterar permissões",
  },
]

export const MODULO_LABELS = Object.fromEntries(
  MODULOS.map((m) => [m.key, m.label])
) as Record<ModuloKey, string>

export const MODULO_GRUPOS = ["Operação", "RH", "Administração"] as const

// O que um usuário recém-criado recebe: só o dia a dia do posto. Qualquer coisa
// além disso passa a ser liberação explícita de um administrador.
export const MODULOS_PADRAO: ModuloPermissao[] = [
  { modulo: "EFETIVOS", editar: true },
  { modulo: "RELATORIOS", editar: true },
]

export type ModuloPermissao = { modulo: ModuloKey; editar: boolean }

// Permissão efetiva do usuário na requisição atual.
export type Access = {
  id: string
  name: string | null
  email: string | null
  role: Role
  modulos: ModuloPermissao[]
  // true = todos os postos; false = só os de departmentIds
  todosPostos: boolean
  departmentIds: string[]
}

export function isModuloKey(value: string): value is ModuloKey {
  return (MODULO_KEYS as readonly string[]).includes(value)
}

// ADMIN não depende de linha em UserModulo: o perfil existe justamente para que
// sempre reste alguém capaz de reabrir o acesso dos outros.
function isAdmin(access: Pick<Access, "role">): boolean {
  return access.role === Role.ADMIN
}

export function podeVer(
  access: Access | null | undefined,
  modulo: ModuloKey
): boolean {
  if (!access) return false
  if (isAdmin(access)) return true
  return access.modulos.some((m) => m.modulo === modulo)
}

export function podeEditar(
  access: Access | null | undefined,
  modulo: ModuloKey
): boolean {
  if (!access) return false
  if (isAdmin(access)) return true
  return access.modulos.some((m) => m.modulo === modulo && m.editar)
}

// Salário é o campo sensível do cadastro: acompanha a edição de Colaboradores.
export function podeVerSalario(access: Access | null | undefined): boolean {
  return podeEditar(access, "COLABORADORES")
}

export function verTodosPostos(access: Access | null | undefined): boolean {
  return !!access && (isAdmin(access) || access.todosPostos)
}

// Lista de postos que o usuário enxerga — null quando não há restrição.
// Array vazio é diferente de null: significa "nenhum posto liberado".
export function postosPermitidos(
  access: Access | null | undefined
): string[] | null {
  if (!access) return []
  if (verTodosPostos(access)) return null
  return access.departmentIds
}

export function podeVerPosto(
  access: Access | null | undefined,
  departmentId: string | null | undefined
): boolean {
  if (!access) return false
  if (verTodosPostos(access)) return true
  if (!departmentId) return false
  return access.departmentIds.includes(departmentId)
}

// Filtro Prisma para consultas em Department (`{ id: ... }`).
export function filtroPostoId(access: Access | null | undefined) {
  const ids = postosPermitidos(access)
  return ids === null ? {} : { id: { in: ids } }
}

// Filtro Prisma para consultas que apontam para um posto (`{ departmentId: ... }`).
export function filtroDepartmentId(access: Access | null | undefined) {
  const ids = postosPermitidos(access)
  return ids === null ? {} : { departmentId: { in: ids } }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  RH: "RH",
  GESTOR: "Gestor",
  VIEWER: "Operacional",
}

export const ROLE_DESCRICOES: Record<Role, string> = {
  ADMIN: "Acesso total, inclusive a este cadastro de usuários.",
  RH: "Perfil de RH — os módulos abaixo definem o que ele alcança.",
  GESTOR: "Supervisão — costuma receber os módulos só como consulta.",
  VIEWER: "Operacional de posto — o padrão para quem trabalha no local.",
}
