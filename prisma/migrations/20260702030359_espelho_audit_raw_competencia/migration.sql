-- CreateTable
CREATE TABLE "EspelhoDiaRaw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fechamentoId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "marcacoes" TEXT NOT NULL,
    CONSTRAINT "EspelhoDiaRaw_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "EspelhoFechamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EspelhoEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fechamentoId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EspelhoEvento_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "EspelhoFechamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EspelhoImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "processados" INTEGER NOT NULL,
    "ocorrencias" INTEGER NOT NULL,
    "semJornada" TEXT NOT NULL,
    "naoEncontrados" TEXT NOT NULL,
    "encerradosPulados" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EspelhoCompetencia" (
    "competencia" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "closedAt" DATETIME,
    "closedById" TEXT,
    "closedByName" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "EspelhoDiaRaw_fechamentoId_idx" ON "EspelhoDiaRaw"("fechamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "EspelhoDiaRaw_fechamentoId_data_key" ON "EspelhoDiaRaw"("fechamentoId", "data");

-- CreateIndex
CREATE INDEX "EspelhoEvento_fechamentoId_createdAt_idx" ON "EspelhoEvento"("fechamentoId", "createdAt");

-- CreateIndex
CREATE INDEX "EspelhoImportLog_competencia_createdAt_idx" ON "EspelhoImportLog"("competencia", "createdAt");
