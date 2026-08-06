-- AlterTable
ALTER TABLE "Department" ADD COLUMN "whatsappGrupoId" TEXT;

-- AlterTable
ALTER TABLE "RelatorioDiario" ADD COLUMN "enviadoAt" DATETIME;
ALTER TABLE "RelatorioDiario" ADD COLUMN "enviadoErro" TEXT;
ALTER TABLE "RelatorioDiario" ADD COLUMN "enviadoMessageId" TEXT;
