# Portal Interno

Plataforma que centraliza setores da empresa para consulta e gestão. Esta primeira
versão (MVP) cobre **RH / Pessoas**, com login, perfis de acesso, CRUD completo,
importação de planilhas e um dashboard mensal com indicadores de ponto e pendências.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (tema verde-teal, claro/escuro)
- **Prisma** + **SQLite** (trocar `provider` para `postgresql` quando for para produção)
- **Auth.js (NextAuth v5)** — login por e-mail/senha (bcrypt), sessão JWT
- **SheetJS (xlsx)** para importação de planilhas (.xlsx/.csv)
- **@tanstack/react-table** nas listagens

## Como rodar (desenvolvimento)

```bash
npm install
npx prisma migrate dev      # cria o banco SQLite e aplica as migrações
npm run db:seed             # popula admin, usuários de teste e dados de exemplo
npm run dev                 # http://localhost:3000
```

O arquivo `.env` já vem com `DATABASE_URL`, `AUTH_SECRET` e as credenciais do admin do seed.

## Acessos criados pelo seed

| Perfil      | E-mail                   | Senha       | Acesso                            |
| ----------- | ------------------------ | ----------- | --------------------------------- |
| Admin       | admin@portal.local       | admin123    | Tudo (inclui gestão de usuários)  |
| RH          | rh@portal.local          | portal123   | Apenas RH (com salários)          |
| Gestor      | gestor@portal.local      | portal123   | Leitura de RH                     |

## Perfis e permissões

- `ADMIN` — acesso total + gestão de usuários
- `RH` — vê e edita RH (incluindo salário)
- `GESTOR` — leitura de RH
- `VIEWER` — apenas o painel inicial

As regras ficam centralizadas em [`src/lib/permissions.ts`](src/lib/permissions.ts) e são
aplicadas no `proxy.ts` (gate de login) e nas páginas/Server Actions de cada setor.

## Funcionalidades

- **Dashboard mensal** com indicadores de RH por competência (colaboradores ativos,
  documentos vencidos, ocorrências de ponto por tipo, pendências documentais, progresso
  do fechamento e justificativas por categoria).
- **RH / Pessoas**: CRUD de colaboradores e departamentos; salário visível só p/ RH/Admin.
- **Importação** (RH): upload de `.xlsx`/`.csv`, pré-visualização com erros
  por linha e confirmação; modelo de planilha para download.
- **Usuários** (Admin): CRUD de acessos e perfis.
- Tema claro/escuro com alternância.

## Scripts

| Script              | Descrição                                  |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento                |
| `npm run build`     | Build de produção                          |
| `npm run lint`      | ESLint                                      |
| `npm run typecheck` | Verificação de tipos (tsc)                 |
| `npm run db:seed`   | Popula o banco com dados iniciais          |
| `npm run db:studio` | Abre o Prisma Studio                       |
| `npm run db:reset`  | Recria o banco e roda o seed               |

## Próximos passos (fora do MVP)

Outros setores (TI/Suporte, Comercial), SSO/Microsoft 365, deploy em servidor/nuvem
(migrar para PostgreSQL), logs de auditoria e relatórios em PDF.
