-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "workSchedule" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EspelhoFechamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EspelhoFechamento_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EspelhoOcorrencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fechamentoId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL,
    "marcacoes" TEXT NOT NULL,
    "justificativaCategoria" TEXT,
    "justificativaObs" TEXT,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EspelhoOcorrencia_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "EspelhoFechamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EspelhoFechamento_competencia_idx" ON "EspelhoFechamento"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "EspelhoFechamento_employeeId_competencia_key" ON "EspelhoFechamento"("employeeId", "competencia");

-- CreateIndex
CREATE INDEX "EspelhoOcorrencia_fechamentoId_idx" ON "EspelhoOcorrencia"("fechamentoId");
