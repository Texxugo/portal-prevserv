-- CreateTable
CREATE TABLE "UserModulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "editar" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserModulo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermissaoAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetUserId" TEXT NOT NULL,
    "targetUserName" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "todosPostos" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "password", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserModulo_userId_idx" ON "UserModulo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserModulo_userId_modulo_key" ON "UserModulo"("userId", "modulo");

-- CreateIndex
CREATE INDEX "UserDepartment_userId_idx" ON "UserDepartment"("userId");

-- CreateIndex
CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartment_userId_departmentId_key" ON "UserDepartment"("userId", "departmentId");

-- CreateIndex
CREATE INDEX "PermissaoAuditoria_targetUserId_createdAt_idx" ON "PermissaoAuditoria"("targetUserId", "createdAt");

-- ---------------------------------------------------------------------------
-- Backfill: preserva o acesso que cada usuário já tinha antes desta migração.
-- A ausência de linha em UserModulo é a NEGAÇÃO do módulo, então sem este
-- backfill o deploy tiraria todo mundo de dentro do sistema.
--   ADMIN  -> tudo, inclusive Usuários
--   RH     -> tudo menos Usuários, com edição
--   GESTOR -> tudo menos Usuários, somente leitura (como era o perfil)
--   VIEWER -> nada além de Tarefas
-- ---------------------------------------------------------------------------

-- Quem já enxergava todos os postos continua enxergando.
UPDATE "User" SET "todosPostos" = 1 WHERE "role" IN ('ADMIN', 'RH', 'GESTOR');

INSERT INTO "UserModulo" ("id", "userId", "modulo", "editar")
SELECT lower(hex(randomblob(16))), u."id", m."nome",
       CASE WHEN u."role" = 'GESTOR' THEN 0 ELSE 1 END
FROM "User" u
CROSS JOIN (
    SELECT 'EFETIVOS' AS nome
    UNION ALL SELECT 'RELATORIOS'
    UNION ALL SELECT 'COLABORADORES'
    UNION ALL SELECT 'DEPARTAMENTOS'
    UNION ALL SELECT 'ESCALAS'
    UNION ALL SELECT 'MOVIMENTOS'
    UNION ALL SELECT 'APONTAMENTO'
    UNION ALL SELECT 'ESPELHOS'
    UNION ALL SELECT 'FECHAMENTO'
    UNION ALL SELECT 'PENDENCIAS'
) m
WHERE u."role" IN ('ADMIN', 'RH', 'GESTOR');

-- Cadastro de usuários era exclusivo do ADMIN.
INSERT INTO "UserModulo" ("id", "userId", "modulo", "editar")
SELECT lower(hex(randomblob(16))), u."id", 'USUARIOS', 1
FROM "User" u WHERE u."role" = 'ADMIN';

-- Tarefas não tinha setor: qualquer usuário logado usava o quadro.
INSERT INTO "UserModulo" ("id", "userId", "modulo", "editar")
SELECT lower(hex(randomblob(16))), u."id", 'TAREFAS', 1 FROM "User" u;
