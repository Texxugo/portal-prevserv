-- DropIndex
DROP INDEX "Employee_matricula_key";

-- CreateIndex
CREATE UNIQUE INDEX "Employee_empresa_matricula_key" ON "Employee"("empresa", "matricula");

