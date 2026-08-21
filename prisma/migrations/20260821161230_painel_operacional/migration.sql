-- AlterTable
ALTER TABLE "Department" ADD COLUMN "bairro" TEXT;
ALTER TABLE "Department" ADD COLUMN "cep" TEXT;
ALTER TABLE "Department" ADD COLUMN "cidade" TEXT;
ALTER TABLE "Department" ADD COLUMN "complemento" TEXT;
ALTER TABLE "Department" ADD COLUMN "geocodeStatus" TEXT;
ALTER TABLE "Department" ADD COLUMN "geocodedAt" DATETIME;
ALTER TABLE "Department" ADD COLUMN "lat" REAL;
ALTER TABLE "Department" ADD COLUMN "lng" REAL;
ALTER TABLE "Department" ADD COLUMN "logradouro" TEXT;
ALTER TABLE "Department" ADD COLUMN "numero" TEXT;
ALTER TABLE "Department" ADD COLUMN "uf" TEXT;

-- CreateTable
CREATE TABLE "CoberturaVaga" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "periodo" TEXT NOT NULL,
    "horario" TEXT,
    "motivo" TEXT NOT NULL,
    "observacao" TEXT,
    "origemMovementId" TEXT,
    "ausenteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "cobertaPorId" TEXT,
    "cobertaEm" DATETIME,
    "efetivoId" TEXT,
    "criadaPor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoberturaVaga_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoberturaVaga_origemMovementId_fkey" FOREIGN KEY ("origemMovementId") REFERENCES "Movement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoberturaVaga_ausenteId_fkey" FOREIGN KEY ("ausenteId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoberturaVaga_cobertaPorId_fkey" FOREIGN KEY ("cobertaPorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoberturaConvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vagaId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "etapa" TEXT NOT NULL DEFAULT 'AGUARDANDO_RESPOSTA',
    "precisaDeslocamento" BOOLEAN,
    "distanciaKm" REAL,
    "enviadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoAt" DATETIME,
    "respostaTexto" TEXT,
    "zaapiMessageId" TEXT,
    "erro" TEXT,
    "criadoPor" TEXT NOT NULL,
    CONSTRAINT "CoberturaConvite_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "CoberturaVaga" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoberturaConvite_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "empresa" TEXT,
    "matricula" TEXT,
    "cpf" TEXT,
    "phone" TEXT,
    "sexo" TEXT,
    "endereco" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "lat" REAL,
    "lng" REAL,
    "geocodedAt" DATETIME,
    "geocodeStatus" TEXT,
    "whatsappOptOut" BOOLEAN NOT NULL DEFAULT false,
    "whatsappOptOutAt" DATETIME,
    "departmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "escalaId" TEXT,
    "escalaInicio" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("cpf", "createdAt", "departmentId", "empresa", "endereco", "escalaId", "escalaInicio", "id", "matricula", "name", "phone", "status", "updatedAt") SELECT "cpf", "createdAt", "departmentId", "empresa", "endereco", "escalaId", "escalaInicio", "id", "matricula", "name", "phone", "status", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_cpf_key" ON "Employee"("cpf");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_matricula_idx" ON "Employee"("matricula");
CREATE INDEX "Employee_escalaId_idx" ON "Employee"("escalaId");
CREATE UNIQUE INDEX "Employee_empresa_matricula_key" ON "Employee"("empresa", "matricula");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CoberturaVaga_departmentId_date_idx" ON "CoberturaVaga"("departmentId", "date");

-- CreateIndex
CREATE INDEX "CoberturaVaga_status_date_idx" ON "CoberturaVaga"("status", "date");

-- CreateIndex
CREATE INDEX "CoberturaVaga_origemMovementId_idx" ON "CoberturaVaga"("origemMovementId");

-- CreateIndex
CREATE INDEX "CoberturaConvite_vagaId_idx" ON "CoberturaConvite"("vagaId");

-- CreateIndex
CREATE INDEX "CoberturaConvite_employeeId_idx" ON "CoberturaConvite"("employeeId");

-- CreateIndex
CREATE INDEX "CoberturaConvite_phone_etapa_idx" ON "CoberturaConvite"("phone", "etapa");

-- CreateIndex
CREATE INDEX "CoberturaConvite_status_idx" ON "CoberturaConvite"("status");
