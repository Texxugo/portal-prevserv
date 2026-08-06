-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RelatorioDiario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "periodo" TEXT NOT NULL,
    "responsavel" TEXT,
    "encomendasProxTurno" INTEGER,
    "horaEncerramento" TEXT,
    "postoPassadoPara" TEXT,
    "observacoes" TEXT,
    "mensagem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "codigo" TEXT,
    "finalizadoAt" DATETIME,
    "finalizadoPorNome" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RelatorioDiario_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RelatorioDiario" ("createdAt", "createdById", "createdByName", "date", "departmentId", "encomendasProxTurno", "horaEncerramento", "id", "mensagem", "observacoes", "periodo", "postoPassadoPara", "responsavel", "updatedAt") SELECT "createdAt", "createdById", "createdByName", "date", "departmentId", "encomendasProxTurno", "horaEncerramento", "id", "mensagem", "observacoes", "periodo", "postoPassadoPara", "responsavel", "updatedAt" FROM "RelatorioDiario";
DROP TABLE "RelatorioDiario";
ALTER TABLE "new_RelatorioDiario" RENAME TO "RelatorioDiario";
CREATE UNIQUE INDEX "RelatorioDiario_codigo_key" ON "RelatorioDiario"("codigo");
CREATE INDEX "RelatorioDiario_departmentId_date_idx" ON "RelatorioDiario"("departmentId", "date");
CREATE UNIQUE INDEX "RelatorioDiario_departmentId_date_periodo_key" ON "RelatorioDiario"("departmentId", "date", "periodo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
