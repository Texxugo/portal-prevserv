-- CreateTable
CREATE TABLE "PontoCorrecao" (
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
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PontoCorrecao_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "EspelhoOcorrencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PontoCorrecao_codigo_key" ON "PontoCorrecao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "PontoCorrecao_occurrenceId_key" ON "PontoCorrecao"("occurrenceId");

-- CreateIndex
CREATE INDEX "PontoCorrecao_employeeId_idx" ON "PontoCorrecao"("employeeId");
