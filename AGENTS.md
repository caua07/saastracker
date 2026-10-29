# Saastemics

Aplicativo exclusivamente pessoal, gratuito e com design como prioridade. Leia `PRODUCT.md` e `DESIGN.md` antes de alterar UI. O plano detalhado em `docs/subscription-tracker-plan.md` contém pesquisa e possibilidades opcionais; não transforme todo o desenho futuro em obrigação.

- Stack: Next.js App Router/TypeScript, PostgreSQL/Drizzle, Better Auth, CSS com tokens e Manrope local.
- Rode `npm run setup:local` e `npm run dev`. O servidor pessoal escuta somente `127.0.0.1:3000`.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, `npm audit`.
- E2E usa banco `saastemics_e2e` e porta 3001, nunca o banco pessoal. Não limpar dados pessoais para rodar teste.
- Schema em `src/server/db/schema.ts`; `npm run db:generate` cria migration. Revise antes de `npm run db:migrate`. Nunca aplicar migrations de produção sem escopo/autorização correspondente.
- Segredos ficam em `.env.local`/host; não ler/imprimir tokens ou dados financeiros desnecessariamente. Backups, logs, client props e bundles não podem carregar segredos.
- Somente o proprietário verificado acessa APIs financeiras; verificar origem e versão em mutações. Mantenha isolamento demo/privado e recusa de login local em produção.
- Moedas usam decimal exato. Equivalente mensal, projeção e gasto registrado são conceitos diferentes. Ausência de FX/evidência nunca significa zero.
- Sem SaaS comercial, billing próprio, multi-tenancy, conta paga, upgrade automático ou worker permanente.
- Integrações reais dependem de credenciais/cobertura. Não representar integração não validada como sincronizada. Não enviar mensagens ou conectar Gmail sem instrução correspondente.
- Use Impeccable em alterações de UI. Valide desktop/mobile em passes limitados e preserve a acessibilidade.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
