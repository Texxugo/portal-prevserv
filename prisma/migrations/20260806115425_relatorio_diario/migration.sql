-- CreateTable
CREATE TABLE "RelatorioDiario" (
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
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RelatorioDiario_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelatorioVeiculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relatorioId" TEXT NOT NULL,
    "identificacao" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "placaNormalizada" TEXT NOT NULL,
    "kmInicial" INTEGER,
    "kmFinal" INTEGER,
    "kmRodado" INTEGER,
    "kmProximaTroca" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RelatorioVeiculo_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelatorioEncomenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relatorioId" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "quadraLote" TEXT,
    "codigos" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RelatorioEncomenda_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelatorioItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relatorioId" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "valor" INTEGER,
    "status" TEXT,
    "observacao" TEXT,
    CONSTRAINT "RelatorioItem_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelatorioVistoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relatorioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "quadraLote" TEXT,
    "endereco" TEXT,
    "proprietario" TEXT,
    "responsavel" TEXT,
    "situacao" TEXT,
    "apontamentos" TEXT NOT NULL,
    "observacao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RelatorioVistoria_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelatorioModeloItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RelatorioModeloItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RelatorioDiario_departmentId_date_idx" ON "RelatorioDiario"("departmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioDiario_departmentId_date_periodo_key" ON "RelatorioDiario"("departmentId", "date", "periodo");

-- CreateIndex
CREATE INDEX "RelatorioVeiculo_relatorioId_idx" ON "RelatorioVeiculo"("relatorioId");

-- CreateIndex
CREATE INDEX "RelatorioVeiculo_placaNormalizada_idx" ON "RelatorioVeiculo"("placaNormalizada");

-- CreateIndex
CREATE INDEX "RelatorioEncomenda_relatorioId_idx" ON "RelatorioEncomenda"("relatorioId");

-- CreateIndex
CREATE INDEX "RelatorioItem_relatorioId_secao_idx" ON "RelatorioItem"("relatorioId", "secao");

-- CreateIndex
CREATE INDEX "RelatorioVistoria_relatorioId_tipo_idx" ON "RelatorioVistoria"("relatorioId", "tipo");

-- CreateIndex
CREATE INDEX "RelatorioModeloItem_departmentId_secao_ordem_idx" ON "RelatorioModeloItem"("departmentId", "secao", "ordem");
