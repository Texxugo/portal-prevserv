-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "matricula" TEXT;

-- CreateTable
CREATE TABLE "WhatsappMessageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "matricula" TEXT,
    "employeeName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "zaapiMessageId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_matricula_key" ON "Employee"("matricula");

-- CreateIndex
CREATE INDEX "Employee_matricula_idx" ON "Employee"("matricula");

-- CreateIndex
CREATE INDEX "WhatsappMessageLog_competencia_idx" ON "WhatsappMessageLog"("competencia");

-- CreateIndex
CREATE INDEX "WhatsappMessageLog_matricula_idx" ON "WhatsappMessageLog"("matricula");
