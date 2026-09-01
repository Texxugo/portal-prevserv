-- CreateTable
CREATE TABLE "EspelhoVinculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "matricula" TEXT,
    "empresa" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EspelhoVinculo_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EspelhoImportPendencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "matricula" TEXT,
    "empresa" TEXT,
    "employeeId" TEXT,
    "dias" TEXT NOT NULL,
    "diasCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "motivo" TEXT,
    "fileName" TEXT NOT NULL,
    "actorName" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EspelhoImportPendencia_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EspelhoImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT,
    "periodoInicio" DATETIME,
    "periodoFim" DATETIME,
    "origem" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "processados" INTEGER NOT NULL,
    "ocorrencias" INTEGER NOT NULL,
    "pendencias" INTEGER NOT NULL DEFAULT 0,
    "semJornada" TEXT NOT NULL,
    "naoEncontrados" TEXT NOT NULL,
    "encerradosPulados" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_EspelhoImportLog" ("actorName", "actorUserId", "competencia", "createdAt", "encerradosPulados", "fileName", "id", "naoEncontrados", "ocorrencias", "origem", "processados", "semJornada") SELECT "actorName", "actorUserId", "competencia", "createdAt", "encerradosPulados", "fileName", "id", "naoEncontrados", "ocorrencias", "origem", "processados", "semJornada" FROM "EspelhoImportLog";
DROP TABLE "EspelhoImportLog";
ALTER TABLE "new_EspelhoImportLog" RENAME TO "EspelhoImportLog";
CREATE INDEX "EspelhoImportLog_competencia_createdAt_idx" ON "EspelhoImportLog"("competencia", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EspelhoVinculo_chave_key" ON "EspelhoVinculo"("chave");

-- CreateIndex
CREATE INDEX "EspelhoVinculo_employeeId_idx" ON "EspelhoVinculo"("employeeId");

-- CreateIndex
CREATE INDEX "EspelhoImportPendencia_competencia_status_idx" ON "EspelhoImportPendencia"("competencia", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EspelhoImportPendencia_competencia_chave_key" ON "EspelhoImportPendencia"("competencia", "chave");
