-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PontoCorrecao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "cpf" TEXT,
    "matricula" TEXT,
    "empresa" TEXT,
    "competencia" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "marcacoes" TEXT NOT NULL,
    "camposFaltantes" INTEGER NOT NULL DEFAULT 1,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PontoCorrecao_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "EspelhoOcorrencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PontoCorrecao" ("actorName", "actorUserId", "codigo", "competencia", "cpf", "createdAt", "data", "employeeId", "employeeName", "empresa", "id", "marcacoes", "matricula", "occurrenceId") SELECT "actorName", "actorUserId", "codigo", "competencia", "cpf", "createdAt", "data", "employeeId", "employeeName", "empresa", "id", "marcacoes", "matricula", "occurrenceId" FROM "PontoCorrecao";
DROP TABLE "PontoCorrecao";
ALTER TABLE "new_PontoCorrecao" RENAME TO "PontoCorrecao";
CREATE UNIQUE INDEX "PontoCorrecao_codigo_key" ON "PontoCorrecao"("codigo");
CREATE UNIQUE INDEX "PontoCorrecao_occurrenceId_key" ON "PontoCorrecao"("occurrenceId");
CREATE INDEX "PontoCorrecao_employeeId_idx" ON "PontoCorrecao"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
