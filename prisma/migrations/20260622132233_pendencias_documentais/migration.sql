-- CreateTable
CREATE TABLE "DocumentoTipo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentoPendencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "matricula" TEXT,
    "competencia" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "occurrenceId" TEXT,
    "sourceDate" DATETIME,
    "sourceType" TEXT,
    "sourceDetail" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "followUpDate" DATETIME NOT NULL,
    "externalUrl" TEXT,
    "requestedAt" DATETIME,
    "receivedAt" DATETIME,
    "canceledAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentoPendencia_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentoPendencia_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentoTipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentoPendencia_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "EspelhoOcorrencia" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentoPendenciaHistorico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pendenciaId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoPendenciaHistorico_pendenciaId_fkey" FOREIGN KEY ("pendenciaId") REFERENCES "DocumentoPendencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoTipo_name_key" ON "DocumentoTipo"("name");

-- CreateIndex
CREATE INDEX "DocumentoPendencia_employeeId_idx" ON "DocumentoPendencia"("employeeId");

-- CreateIndex
CREATE INDEX "DocumentoPendencia_occurrenceId_idx" ON "DocumentoPendencia"("occurrenceId");

-- CreateIndex
CREATE INDEX "DocumentoPendencia_competencia_status_idx" ON "DocumentoPendencia"("competencia", "status");

-- CreateIndex
CREATE INDEX "DocumentoPendencia_status_followUpDate_idx" ON "DocumentoPendencia"("status", "followUpDate");

-- CreateIndex
CREATE INDEX "DocumentoPendenciaHistorico_pendenciaId_createdAt_idx" ON "DocumentoPendenciaHistorico"("pendenciaId", "createdAt");
