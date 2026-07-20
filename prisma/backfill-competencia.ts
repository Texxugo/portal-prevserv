import { PrismaClient } from "@prisma/client"

import { competenciaFromDate } from "../src/lib/competencia"

const prisma = new PrismaClient()

async function main() {
  const movements = await prisma.movement.findMany({
    select: { id: true, startDate: true },
  })
  let updated = 0
  for (const m of movements) {
    await prisma.movement.update({
      where: { id: m.id },
      data: { competencia: competenciaFromDate(m.startDate) },
    })
    updated++
  }
  console.log(`Backfill competência: ${updated} registro(s) atualizados.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
