import { prisma } from "@/lib/db"

// Acesso genérico ao model Setting (chave/valor).

export async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}
