import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

import { competenciaFromDate } from "../src/lib/competencia"

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@portal.local"
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123"
  const testPassword = "portal123"

  const adminHash = await bcrypt.hash(adminPassword, 10)
  const testHash = await bcrypt.hash(testPassword, 10)

  // Usuários (admin + um por perfil para testar permissões)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Administrador", email: adminEmail, password: adminHash, role: Role.ADMIN },
  })

  const testUsers: { name: string; email: string; role: Role }[] = [
    { name: "Maria (RH)", email: "rh@portal.local", role: Role.RH },
    { name: "Carla (Gestora)", email: "gestor@portal.local", role: Role.GESTOR },
  ]
  for (const u of testUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: testHash },
    })
  }

  // Departamentos
  const departmentNames = [
    "Diretoria",
    "Pessoas",
    "Financeiro",
    "Tecnologia",
    "Comercial",
    "Operações",
  ]
  for (const name of departmentNames) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } })
  }
  const departments = await prisma.department.findMany()
  const depId = (name: string) => departments.find((d) => d.name === name)?.id

  // Tipos iniciais para acompanhamento de pendências documentais
  for (const name of [
    "Atestado",
    "Declaração",
    "Correção de ponto",
    "Comprovante",
    "Outro",
  ]) {
    await prisma.documentoTipo.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  // Colaboradores de exemplo (apenas se não houver nenhum)
  if ((await prisma.employee.count()) === 0) {
    await prisma.employee.createMany({
      data: [
        { name: "Ana Souza", empresa: "Prevserv", cpf: "111.111.111-11", matricula: "1001", phone: "1001", departmentId: depId("Pessoas"), status: "ATIVO" },
        { name: "Bruno Lima", empresa: "Prevserv", cpf: "222.222.222-22", matricula: "1002", phone: "1002", departmentId: depId("Tecnologia"), status: "ATIVO" },
        { name: "Carla Dias", empresa: "Prevserv", cpf: "333.333.333-33", matricula: "1003", phone: "1003", departmentId: depId("Comercial"), status: "ATIVO" },
        { name: "Diego Alves", empresa: "Prevserv", cpf: "444.444.444-44", matricula: "1004", phone: "1004", departmentId: depId("Financeiro"), status: "AFASTADO" },
        { name: "Elaine Rocha", empresa: "Prevserv", cpf: "555.555.555-55", matricula: "1005", phone: "1005", departmentId: depId("Operações"), status: "INATIVO" },
      ],
    })
  }

  // Movimentações de exemplo (apenas se não houver nenhuma)
  if ((await prisma.movement.count()) === 0) {
    const emps = await prisma.employee.findMany()
    const empId = (name: string) => emps.find((e) => e.name === name)?.id
    const data = [
      { employeeId: empId("Ana Souza"), type: "FALTA", justificada: false, startDate: new Date("2026-06-02"), note: "Sem aviso prévio" },
      { employeeId: empId("Ana Souza"), type: "FALTA", justificada: true, startDate: new Date("2026-06-09"), note: "Atestado médico" },
      { employeeId: empId("Bruno Lima"), type: "FERIAS", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-15") },
      { employeeId: empId("Bruno Lima"), type: "FALTA", justificada: false, startDate: new Date("2026-06-18") },
      { employeeId: empId("Carla Dias"), type: "CONTRATACAO", startDate: new Date("2020-01-10") },
      { employeeId: empId("Elaine Rocha"), type: "DEMISSAO", startDate: new Date("2026-05-20"), note: "Pedido de demissão" },
    ]
      .filter((m) => m.employeeId)
      .map((m) => ({ ...m, competencia: competenciaFromDate(m.startDate) })) as {
      employeeId: string
      type: string
      justificada?: boolean
      startDate: Date
      endDate?: Date
      note?: string
      competencia: string
    }[]
    await prisma.movement.createMany({ data })
  }

  console.log("Seed concluído.")
  console.log(`  Admin:  ${adminEmail} / ${adminPassword}`)
  console.log(`  RH:     rh@portal.local / ${testPassword}`)
  console.log(`  Gestor: gestor@portal.local / ${testPassword}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
