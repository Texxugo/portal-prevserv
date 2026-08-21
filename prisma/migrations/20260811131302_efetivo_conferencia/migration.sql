-- CreateTable
CREATE TABLE "EfetivoConferencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "periodo" TEXT NOT NULL,
    "confirmadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorName" TEXT NOT NULL,
    CONSTRAINT "EfetivoConferencia_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EfetivoConferencia_date_idx" ON "EfetivoConferencia"("date");

-- CreateIndex
CREATE UNIQUE INDEX "EfetivoConferencia_departmentId_date_periodo_key" ON "EfetivoConferencia"("departmentId", "date", "periodo");

-- CreateIndex
CREATE INDEX "Efetivo_departmentId_date_idx" ON "Efetivo"("departmentId", "date");
