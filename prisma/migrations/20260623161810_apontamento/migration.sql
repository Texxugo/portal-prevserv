-- CreateTable
CREATE TABLE "Apontamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "valeTransporte" INTEGER NOT NULL DEFAULT 0,
    "valeRefeicao" INTEGER NOT NULL DEFAULT 0,
    "adicionalNoturno" INTEGER,
    "he50" TEXT,
    "he100" TEXT,
    "intra" INTEGER,
    "faltasE" INTEGER,
    "faltasF" INTEGER,
    "faltasJust" INTEGER,
    "faltasNJust" INTEGER,
    "dsr" INTEGER,
    "gratPercent" INTEGER,
    "recebeCesta" BOOLEAN NOT NULL DEFAULT true,
    "recebeAssiduidade" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Apontamento_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Apontamento_competencia_idx" ON "Apontamento"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "Apontamento_employeeId_competencia_key" ON "Apontamento"("employeeId", "competencia");
