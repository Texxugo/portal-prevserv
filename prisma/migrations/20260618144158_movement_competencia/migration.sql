-- AlterTable
ALTER TABLE "Movement" ADD COLUMN "competencia" TEXT;

-- CreateIndex
CREATE INDEX "Movement_competencia_idx" ON "Movement"("competencia");

-- CreateIndex
CREATE INDEX "Movement_competencia_type_idx" ON "Movement"("competencia", "type");
