-- CreateTable
CREATE TABLE "Efetivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "periodo" TEXT NOT NULL,
    "evento" TEXT,
    "extra" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Efetivo_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Efetivo_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Efetivo_employeeId_idx" ON "Efetivo"("employeeId");

-- CreateIndex
CREATE INDEX "Efetivo_departmentId_idx" ON "Efetivo"("departmentId");

-- CreateIndex
CREATE INDEX "Efetivo_date_idx" ON "Efetivo"("date");
