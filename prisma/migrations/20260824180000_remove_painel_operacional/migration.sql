-- DropIndex
DROP INDEX "CoberturaConvite_status_idx";

-- DropIndex
DROP INDEX "CoberturaConvite_phone_etapa_idx";

-- DropIndex
DROP INDEX "CoberturaConvite_employeeId_idx";

-- DropIndex
DROP INDEX "CoberturaConvite_vagaId_idx";

-- DropIndex
DROP INDEX "CoberturaVaga_origemMovementId_idx";

-- DropIndex
DROP INDEX "CoberturaVaga_status_date_idx";

-- DropIndex
DROP INDEX "CoberturaVaga_departmentId_date_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CoberturaConvite";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CoberturaVaga";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "whatsappGrupoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Department" ("createdAt", "id", "name", "updatedAt", "whatsappGrupoId") SELECT "createdAt", "id", "name", "updatedAt", "whatsappGrupoId" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "empresa" TEXT,
    "matricula" TEXT,
    "cpf" TEXT,
    "phone" TEXT,
    "endereco" TEXT,
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

