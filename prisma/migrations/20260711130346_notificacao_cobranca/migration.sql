-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_dedupeKey_key" ON "Notificacao"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notificacao_readAt_createdAt_idx" ON "Notificacao"("readAt", "createdAt");
