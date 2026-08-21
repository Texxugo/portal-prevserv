-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoberturaConvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vagaId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "canal" TEXT NOT NULL DEFAULT 'TEXTO',
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
INSERT INTO "new_CoberturaConvite" ("criadoPor", "distanciaKm", "employeeId", "enviadoAt", "erro", "etapa", "id", "phone", "precisaDeslocamento", "respondidoAt", "respostaTexto", "status", "vagaId", "zaapiMessageId") SELECT "criadoPor", "distanciaKm", "employeeId", "enviadoAt", "erro", "etapa", "id", "phone", "precisaDeslocamento", "respondidoAt", "respostaTexto", "status", "vagaId", "zaapiMessageId" FROM "CoberturaConvite";
DROP TABLE "CoberturaConvite";
ALTER TABLE "new_CoberturaConvite" RENAME TO "CoberturaConvite";
CREATE INDEX "CoberturaConvite_vagaId_idx" ON "CoberturaConvite"("vagaId");
CREATE INDEX "CoberturaConvite_employeeId_idx" ON "CoberturaConvite"("employeeId");
CREATE INDEX "CoberturaConvite_phone_etapa_idx" ON "CoberturaConvite"("phone", "etapa");
CREATE INDEX "CoberturaConvite_status_idx" ON "CoberturaConvite"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
