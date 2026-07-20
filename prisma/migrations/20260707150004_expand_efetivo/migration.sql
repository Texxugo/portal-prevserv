-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentoPendencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "matricula" TEXT,
    "competencia" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "occurrenceId" TEXT,
    "efetivoId" TEXT,
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
    CONSTRAINT "DocumentoPendencia_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "EspelhoOcorrencia" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentoPendencia_efetivoId_fkey" FOREIGN KEY ("efetivoId") REFERENCES "Efetivo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentoPendencia" ("canceledAt", "competencia", "createdAt", "createdById", "createdByName", "documentTypeId", "employeeId", "employeeName", "externalUrl", "followUpDate", "id", "matricula", "notes", "occurrenceId", "reason", "receivedAt", "requestedAt", "sourceDate", "sourceDetail", "sourceType", "status", "updatedAt") SELECT "canceledAt", "competencia", "createdAt", "createdById", "createdByName", "documentTypeId", "employeeId", "employeeName", "externalUrl", "followUpDate", "id", "matricula", "notes", "occurrenceId", "reason", "receivedAt", "requestedAt", "sourceDate", "sourceDetail", "sourceType", "status", "updatedAt" FROM "DocumentoPendencia";
DROP TABLE "DocumentoPendencia";
ALTER TABLE "new_DocumentoPendencia" RENAME TO "DocumentoPendencia";
CREATE INDEX "DocumentoPendencia_employeeId_idx" ON "DocumentoPendencia"("employeeId");
CREATE INDEX "DocumentoPendencia_occurrenceId_idx" ON "DocumentoPendencia"("occurrenceId");
CREATE INDEX "DocumentoPendencia_efetivoId_idx" ON "DocumentoPendencia"("efetivoId");
CREATE INDEX "DocumentoPendencia_competencia_status_idx" ON "DocumentoPendencia"("competencia", "status");
CREATE INDEX "DocumentoPendencia_status_followUpDate_idx" ON "DocumentoPendencia"("status", "followUpDate");
CREATE TABLE "new_Efetivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "freelancerName" TEXT,
    "departmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "horario" TEXT,
    "local" TEXT,
    "evento" TEXT,
    "periodo" TEXT NOT NULL,
    "extra" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Efetivo_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Efetivo_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Efetivo" ("createdAt", "date", "departmentId", "employeeId", "evento", "extra", "id", "periodo", "updatedAt") SELECT "createdAt", "date", "departmentId", "employeeId", "evento", "extra", "id", "periodo", "updatedAt" FROM "Efetivo";
DROP TABLE "Efetivo";
ALTER TABLE "new_Efetivo" RENAME TO "Efetivo";
CREATE INDEX "Efetivo_employeeId_idx" ON "Efetivo"("employeeId");
CREATE INDEX "Efetivo_departmentId_idx" ON "Efetivo"("departmentId");
CREATE INDEX "Efetivo_date_idx" ON "Efetivo"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
