-- Funde os módulos ESPELHOS e FECHAMENTO em PONTO (união permissiva):
-- quem tinha qualquer um dos dois passa a ver PONTO; quem tinha editar em
-- qualquer um dos dois passa a editar PONTO. Ninguém perde acesso.
-- Migração de dados: o schema não muda, a chave do módulo é texto em UserModulo.

-- 1) Trilha de auditoria ANTES de mexer, para registrar o estado anterior.
INSERT INTO "PermissaoAuditoria" ("id", "targetUserId", "targetUserName", "actorUserId", "actorName", "acao", "detalhes", "createdAt")
SELECT
  'mig' || lower(hex(randomblob(12))),
  u."id",
  u."name",
  'sistema',
  'Migração automática',
  'ALTERACAO',
  'Módulos "Espelhos de ponto" e "Encerramento de espelho" fundidos em "Ponto eletrônico". Antes: '
    || group_concat(
         CASE m."modulo" WHEN 'ESPELHOS' THEN 'Espelhos de ponto' ELSE 'Encerramento de espelho' END
         || CASE WHEN m."editar" = 1 THEN ' (editar)' ELSE ' (só ver)' END,
         ', '
       )
    || '. Depois: Ponto eletrônico'
    || CASE WHEN MAX(m."editar") = 1 THEN ' (editar)' ELSE ' (só ver)' END
    || '.',
  CURRENT_TIMESTAMP
FROM "UserModulo" m
JOIN "User" u ON u."id" = m."userId"
WHERE m."modulo" IN ('ESPELHOS', 'FECHAMENTO')
GROUP BY u."id", u."name";

-- 2) Cria a linha do módulo novo com a permissão mais alta entre os dois antigos.
INSERT INTO "UserModulo" ("id", "userId", "modulo", "editar")
SELECT
  'mig' || lower(hex(randomblob(12))),
  m."userId",
  'PONTO',
  MAX(m."editar")
FROM "UserModulo" m
WHERE m."modulo" IN ('ESPELHOS', 'FECHAMENTO')
  AND NOT EXISTS (
    SELECT 1 FROM "UserModulo" p WHERE p."userId" = m."userId" AND p."modulo" = 'PONTO'
  )
GROUP BY m."userId";

-- 3) Remove as chaves antigas: elas não existem mais em MODULO_KEYS.
DELETE FROM "UserModulo" WHERE "modulo" IN ('ESPELHOS', 'FECHAMENTO');
