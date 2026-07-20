"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { requireSectorEdit } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { canEdit } from "@/lib/permissions"
import { setSetting } from "@/lib/settings"
import { normalizePhone } from "@/lib/zapi"
import { COBRANCA_PHONE_KEY } from "@/lib/notificacoes/config"

export type NotificacaoItem = {
  id: string
  title: string
  message: string
  href: string | null
  readAt: string | null
  createdAt: string
}

// Guard suave: usado em polling do sino — sessão expirada não pode redirecionar.
async function canReadNotificacoes(): Promise<boolean> {
  const session = await auth()
  const role = session?.user?.role
  return !!role && canEdit(role, "rh")
}

export async function getNotificacoes(): Promise<{
  items: NotificacaoItem[]
  unread: number
}> {
  if (!(await canReadNotificacoes())) return { items: [], unread: 0 }

  const [rows, unread] = await Promise.all([
    prisma.notificacao.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.notificacao.count({ where: { readAt: null } }),
  ])

  return {
    items: rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      href: n.href,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  }
}

export async function marcarNotificacoesLidas(): Promise<{ ok: boolean }> {
  if (!(await canReadNotificacoes())) return { ok: false }
  await prisma.notificacao.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  })
  return { ok: true }
}

export async function setCobrancaPhone(
  phone: string
): Promise<{ ok: boolean; error?: string }> {
  await requireSectorEdit("rh")
  const trimmed = phone.trim()
  if (trimmed) {
    const normalized = normalizePhone(trimmed)
    if (!normalized || normalized.length < 12) {
      return { ok: false, error: "Telefone inválido. Use DDD + número." }
    }
  }
  await setSetting(COBRANCA_PHONE_KEY, trimmed)
  revalidatePath("/rh/pendencias")
  return { ok: true }
}
