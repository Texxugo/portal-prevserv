-- CreateTable
CREATE TABLE "Escala" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cycleDays" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cpf" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "departmentId" TEXT,
    "admissionDate" DATETIME,
    "salary" REAL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "workSchedule" TEXT,
    "escalaId" TEXT,
    "escalaInicio" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("admissionDate", "cpf", "createdAt", "departmentId", "email", "id", "matricula", "name", "phone", "position", "salary", "status", "updatedAt", "workSchedule") SELECT "admissionDate", "cpf", "createdAt", "departmentId", "email", "id", "matricula", "name", "phone", "position", "salary", "status", "updatedAt", "workSchedule" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_matricula_key" ON "Employee"("matricula");
CREATE UNIQUE INDEX "Employee_cpf_key" ON "Employee"("cpf");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_matricula_idx" ON "Employee"("matricula");
CREATE INDEX "Employee_escalaId_idx" ON "Employee"("escalaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Escala_name_key" ON "Escala"("name");
