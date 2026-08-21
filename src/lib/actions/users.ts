"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma, type Role } from "@prisma/client"
import bcrypt from "bcryptjs"

import { actorName, requireModuloEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { toFieldErrors, type FormState } from "@/lib/form"
import {
  MODULOS,
  MODULO_LABELS,
  ROLE_LABELS,
  type ModuloPermissao,
} from "@/lib/permissions"
import { userCreateSchema, userUpdateSchema } from "@/lib/schemas"

// Permissões chegam como um par de checkboxes por módulo (`mod_X` = vê,
// `edit_X` = edita) e uma lista de postos. Ler campo a campo, em vez de um JSON
// escondido, mantém o formulário funcionando sem JavaScript.
type Permissoes = {
  modulos: ModuloPermissao[]
  todosPostos: boolean
  departmentIds: string[]
}

function lerPermissoes(formData: FormData): Permissoes {
  const modulos = MODULOS.flatMap<ModuloPermissao>((m) =>
    formData.get(`mod_${m.key}`)
      ? [{ modulo: m.key, editar: !!formData.get(`edit_${m.key}`) }]
      : []
  )
  const todosPostos = formData.get("todosPostos") === "true"
  return {
    modulos,
    todosPostos,
    // sem restrição de posto, a lista marcada deixa de ter efeito e não é gravada
    departmentIds: todosPostos
      ? []
      : formData.getAll("postos").map((v) => String(v)),
  }
}

// ---------- auditoria ----------

function descreverModulos(modulos: ModuloPermissao[]): string {
  if (modulos.length === 0) return "nenhum"
  return modulos
    .map((m) => `${MODULO_LABELS[m.modulo]}${m.editar ? " (edição)" : ""}`)
    .sort()
    .join(", ")
}

async function descreverPostos(p: Permissoes): Promise<string> {
  if (p.todosPostos) return "todos"
  if (p.departmentIds.length === 0) return "nenhum"
  const postos = await prisma.department.findMany({
    where: { id: { in: p.departmentIds } },
    select: { name: true },
    orderBy: { name: "asc" },
  })
  return postos.map((d) => d.name).join(", ")
}

async function registrarAuditoria(params: {
  targetUserId: string
  targetUserName: string
  actor: { id: string; name?: string | null; email?: string | null }
  acao: "CRIACAO" | "ALTERACAO" | "EXCLUSAO"
  detalhes: string
}) {
  await prisma.permissaoAuditoria.create({
    data: {
      targetUserId: params.targetUserId,
      targetUserName: params.targetUserName,
      actorUserId: params.actor.id,
      actorName: actorName(params.actor),
      acao: params.acao,
      detalhes: params.detalhes,
    },
  })
}

type EstadoPermissao = Permissoes & { role: Role; active: boolean }

// Só o que mudou vira linha de auditoria — histórico cheio de "nada mudou" não
// é histórico, é ruído.
async function diffPermissoes(
  antes: EstadoPermissao,
  depois: EstadoPermissao
): Promise<string[]> {
  const linhas: string[] = []

  if (antes.role !== depois.role) {
    linhas.push(
      `Perfil: ${ROLE_LABELS[antes.role]} → ${ROLE_LABELS[depois.role]}`
    )
  }
  if (antes.active !== depois.active) {
    linhas.push(
      `Status: ${antes.active ? "ativo" : "inativo"} → ${depois.active ? "ativo" : "inativo"}`
    )
  }

  const chave = (m: ModuloPermissao) => `${m.modulo}:${m.editar}`
  const antesSet = new Set(antes.modulos.map(chave))
  const depoisSet = new Set(depois.modulos.map(chave))
  const mesmosModulos =
    antesSet.size === depoisSet.size &&
    [...antesSet].every((k) => depoisSet.has(k))
  if (!mesmosModulos) {
    linhas.push(
      `Módulos: ${descreverModulos(antes.modulos)} → ${descreverModulos(depois.modulos)}`
    )
  }

  const mesmosPostos =
    antes.todosPostos === depois.todosPostos &&
    antes.departmentIds.length === depois.departmentIds.length &&
    antes.departmentIds.every((id) => depois.departmentIds.includes(id))
  if (!mesmosPostos) {
    linhas.push(
      `Postos: ${await descreverPostos(antes)} → ${await descreverPostos(depois)}`
    )
  }

  return linhas
}

// ---------- ações ----------

export async function createUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const me = await requireModuloEdit("USUARIOS")
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const { password, ...rest } = parsed.data
  const hash = await bcrypt.hash(password, 10)
  const perm = lerPermissoes(formData)

  let criado: { id: string; name: string }
  try {
    criado = await prisma.user.create({
      data: {
        ...rest,
        password: hash,
        todosPostos: perm.todosPostos,
        modulos: { create: perm.modulos },
        departments: {
          create: perm.departmentIds.map((departmentId) => ({ departmentId })),
        },
      },
      select: { id: true, name: true },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["Já existe um usuário com este e-mail."] } }
    }
    throw e
  }

  await registrarAuditoria({
    targetUserId: criado.id,
    targetUserName: criado.name,
    actor: me,
    acao: "CRIACAO",
    detalhes: [
      `Perfil: ${ROLE_LABELS[rest.role]}`,
      `Módulos: ${descreverModulos(perm.modulos)}`,
      `Postos: ${await descreverPostos(perm)}`,
    ].join(" · "),
  })

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios")
}

export async function updateUser(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const me = await requireModuloEdit("USUARIOS")
  const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) }

  const antes = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
      active: true,
      todosPostos: true,
      modulos: { select: { modulo: true, editar: true } },
      departments: { select: { departmentId: true } },
    },
  })
  if (!antes) return { errors: { _: ["Usuário não encontrado."] } }

  const { password, ...rest } = parsed.data
  const perm = lerPermissoes(formData)

  // Trava anti-tranca: quem edita a si mesmo não pode se desativar nem tirar o
  // próprio acesso a Usuários — seria fechar a porta por dentro.
  if (me.id === id) {
    const mantemUsuarios =
      rest.role === "ADMIN" ||
      perm.modulos.some((m) => m.modulo === "USUARIOS" && m.editar)
    if (!rest.active || !mantemUsuarios) {
      return {
        errors: {
          _: [
            "Você não pode se desativar nem remover o próprio acesso a Usuários. Peça a outro administrador.",
          ],
        },
      }
    }
  }

  const data: Prisma.UserUpdateInput = { ...rest, todosPostos: perm.todosPostos }
  if (password) data.password = await bcrypt.hash(password, 10)

  try {
    // As permissões são reescritas por inteiro: o formulário sempre manda o
    // estado completo, então reconciliar linha a linha só traria divergência.
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data }),
      prisma.userModulo.deleteMany({ where: { userId: id } }),
      prisma.userModulo.createMany({
        data: perm.modulos.map((m) => ({ userId: id, ...m })),
      }),
      prisma.userDepartment.deleteMany({ where: { userId: id } }),
      prisma.userDepartment.createMany({
        data: perm.departmentIds.map((departmentId) => ({
          userId: id,
          departmentId,
        })),
      }),
    ])
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["Já existe um usuário com este e-mail."] } }
    }
    throw e
  }

  const mudancas = await diffPermissoes(
    {
      role: antes.role,
      active: antes.active,
      todosPostos: antes.todosPostos,
      modulos: antes.modulos as ModuloPermissao[],
      departmentIds: antes.departments.map((d) => d.departmentId),
    },
    { role: rest.role, active: rest.active, ...perm }
  )
  if (mudancas.length > 0) {
    await registrarAuditoria({
      targetUserId: id,
      targetUserName: rest.name,
      actor: me,
      acao: "ALTERACAO",
      detalhes: mudancas.join(" · "),
    })
  }

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios")
}

export async function deleteUser(id: string): Promise<void> {
  const me = await requireModuloEdit("USUARIOS")
  if (me.id === id) {
    throw new Error("Não é possível excluir o próprio usuário.")
  }
  const alvo = await prisma.user.delete({ where: { id } })
  await registrarAuditoria({
    targetUserId: id,
    targetUserName: alvo.name,
    actor: me,
    acao: "EXCLUSAO",
    detalhes: `Usuário ${alvo.email} excluído.`,
  })
  revalidatePath("/admin/usuarios")
}
