-- CreateTable
CREATE TABLE "RelatorioVerificacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "relatorioId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelatorioVerificacao_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RelatorioVerificacao_codigo_createdAt_idx" ON "RelatorioVerificacao"("codigo", "createdAt");

-- CreateIndex
CREATE INDEX "RelatorioVerificacao_createdAt_idx" ON "RelatorioVerificacao"("createdAt");
