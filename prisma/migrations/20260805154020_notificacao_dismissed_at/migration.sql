-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN "dismissedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Notificacao_dismissedAt_idx" ON "Notificacao"("dismissedAt");
