# Neon: configuração e evidências

Executado em 29/10/2026, após autorização explícita para configurar o projeto e testar os serviços reais. Nenhuma credencial é registrada aqui.

## Infraestrutura

- Organização: `org-silent-night-75779993`.
- Projeto existente: `calm-math-74999050` (`saastracker`).
- Região confirmada: `aws-us-east-2`.
- Branch: `production`, ID `br-bitter-wind-b5w7crae`.
- Postgres existente, inicialmente sem tabelas públicas; migrations Drizzle aplicadas.
- Bucket `assets`, acesso `private`. Cada proprietário tem uma única cópia em um caminho calculado no servidor.
- Não foram habilitados Neon Auth, Functions, Data API, Realtime ou AI Gateway. Better Auth e Next.js foram preservados. Nenhum plano foi alterado.

Comandos solicitados:

```sh
npm i -g neon@latest
neon init -y --org-id org-silent-night-75779993 --project-id calm-math-74999050 --branch production --services postgres,object-storage
neon deploy
```

CLI instalado: `8.13.2`. O `init` criou a ligação inicialmente offline. O `deploy` abriu login; após autenticação, retornou:

```text
Auth complete (profile DEFAULT)
→ Applying to branch production (br-bitter-wind-b5w7crae)
Applied changes
  + bucket assets
Utilized services: Postgres, Object Storage
Pulled 7 Neon variables into .env.local
```

`neon config plan` posteriormente confirmou:

```text
No changes — branch production already matches the policy.
Utilized services: Postgres, Object Storage
```

## Configuração preservada e ferramentas de agentes

Antes do `init`, foi feita uma cópia local protegida de `.env.local` em `.local/neon-setup/env.local.before-neon` (permissão 600, ignorada pelo Git). O CLI forneceu `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` e `AWS_REGION`. O `.env.local` continua com permissão 600 e ignorado; `.neon` também foi adicionado ao `.gitignore`.

Na conferência posterior, `OWNER_EMAIL` e `LOCAL_OWNER_PASSWORD` diferiam da cópia inicial. Não eram os valores temporários do teste. Os valores atuais foram preservados: o teste substitui identidade somente no ambiente do processo filho, sem regravar o arquivo.

A skill solicitada foi buscada em [Neon agent skill oficial](https://neon.com/.well-known/agent-skills/neon/SKILL.md). `neon skills status` confirmou as nove skills locais como `up to date`; nenhuma reinstalação local foi necessária.

O comando `init -y` instalou o plugin Neon em escopo de usuário para Claude Code/Claude Desktop, Codex, Cursor e VS Code. Também informou instalação de skills e MCP em escopo de usuário para Gemini CLI, OpenCode e Zed, alterando suas respectivas configurações. Isso é comportamento do comando solicitado, sem `--agent` restrito.

No Codex, foram verificados a entrada do plugin em `~/.codex/config.toml` e seu manifesto `mcp.json`, que aponta para `https://mcp.neon.tech/mcp`, sem segredo embutido. O MCP fornecido pelo plugin já atende ao projeto; não foi criada uma configuração MCP duplicada. A validação desta execução utilizou o CLI autenticado, sem alegar teste de chamada MCP.

## Alterações no aplicativo

| Arquivo                                             | Alteração                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `neon.ts`                                           | Política gerada pelo CLI: bucket privado, Neon Auth desativado e TTL de novas branches não padrão; configuração preservada |
| `.gitignore`                                        | `.neon` ignorado, mantendo regras anteriores de segredos                                                                   |
| `.env.example`                                      | Nomes das variáveis do Neon, sem valores secretos                                                                          |
| `package.json` / lock                               | Config/env do Neon, SDK S3, pool Vercel e comando `verify:neon`                                                            |
| `src/server/db/client.ts`                           | Preserva `pg`/Drizzle, pool pequeno e lifecycle Vercel Fluid                                                               |
| `src/server/db/connection.ts`                       | Mantém verificação TLS completa explícita para URLs Neon                                                                   |
| `scripts/migrate.ts`                                | Lê `.env.local`/`.env`; prioriza a conexão administrativa explícita ou a direta da Neon                                    |
| `src/server/storage.ts`                             | S3 server-only, path-style, timeout, limite de 10 MB, validação do backup e chaves por proprietário                        |
| `src/app/api/backups/route.ts`                      | Salvar, baixar e excluir backup com sessão, verificação de origem e respostas sem cache                                    |
| `src/components/cloud-backup-panel.tsx`             | Ações manuais com loading, erros, confirmação de exclusão e demo desabilitada                                              |
| `src/components/settings-panel.tsx`                 | Integra o painel e adiciona nome acessível ao input de restauração                                                         |
| `tests/storage.test.ts`, `tests/connection.test.ts` | Testes de isolamento de chave, formato/tamanho, ausência versus acesso negado e TLS                                        |
| `scripts/verify-neon.ts`                            | Teste real pelo navegador, com identidade sintética isolada e limpeza ao final                                             |
| `README.md`, este registro                          | Operação, limitações e evidências atuais                                                                                   |

Não foram alterados schema/modelo de dados, integração Pluggy, autenticação existente ou tokens visuais. Skills locais e `skills-lock.json` já tinham sido instalados na etapa anterior. O cache do hook Impeccable pode aparecer modificado; não é configuração funcional nem evidência de teste. O hook também informou drift anterior de timestamp entre DESIGN.md e sidecar; o sistema visual não foi reescrito.

O SDK S3 nativo foi escolhido para operações pequenas de backup com controle explícito de privacidade, limites e validação, sem outras abstrações de arquivos. Mantido `pg` porque o app usa Node.js e transações interativas, com hospedagem Vercel Fluid planejada. Fontes: [conexões](https://neon.com/docs/connect/choose-connection), [Vercel](https://neon.com/docs/guides/vercel-connection-methods), [Object Storage](https://neon.com/docs/storage/get-started).

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:neon -- --allow-production-smoke
npm audit
```

O teste real cria identidade, assinatura e objeto sintéticos na branch configurada. Não usa nem limpa o proprietário real. O flag explícito é obrigatório. O script inicia Next dev em loopback na porta 3002, com identidade temporária apenas no processo; remove suas linhas e objeto e encerra o servidor no `finally`. Ele não substitui uma validação do login Google de produção.

Saída confirmada:

```text
Test Files  6 passed (6)
Tests       32 passed (32)
✓ Compiled successfully
✓ Generating static pages using 13 workers (8/8)
PASS APP GET /login HTTP 200 (Neon env)
PASS SECURITY anonymous cloud backup HTTP 401
PASS AUTH local test identity/session persisted in Neon (production Google not exercised)
PASS POSTGRES UI create -> committed row -> reload preserved subscription
PASS SECURITY cross-origin cloud mutation HTTP 403
PASS OBJECT STORAGE UI save -> private S3 PUT -> authenticated GET HTTP 200, snapshot matches Postgres
PASS SECURITY anonymous direct object read denied
PASS OBJECT STORAGE browser downloaded saastemics-cloud.json
PASS UI settings axe WCAG A/AA zero violations
PASS UI 390px no horizontal overflow
PASS OBJECT STORAGE UI confirmation -> DELETE -> missing backup HTTP 404
PASS CLEANUP temporary identity, rows and object removed; server stopped
```

As evidências locais do último teste ficam em `.local/neon-setup/verification.txt`; capturas de configurações desktop/mobile em `.impeccable/review/neon/`, ignoradas pelo Git. Os controles novos reutilizam o sistema visual existente, sem novos tokens ou redesenho.

## Problemas encontrados e situação final

- Primeiro teste de acessibilidade das configurações encontrou um input de restauração sem nome acessível. Corrigido com `aria-label`; teste final passou sem violações WCAG A/AA.
- A versão mais recente de `@vercel/functions` trouxe uma dependência transitiva Zod vulnerável. Foi fixada a versão `3.6.1`, que oferece `attachDatabasePool` e não traz aquela cadeia. Manter essa versão até reavaliar a atualização; não usar `audit fix --force`.
- O driver avisou sobre mudança futura da semântica `sslmode=require`. O aplicativo e migrations agora preservam explicitamente verificação completa em URLs Neon, sem editar as credenciais no arquivo.
- Nenhuma falha de provisionamento ou de leitura/escrita ficou pendente.
- Frontend na Vercel e OAuth Google ainda precisam ser configurados. As variáveis do Neon no arquivo local não são automaticamente enviadas à Vercel. A cópia cloud é manual e independente da exclusão dos dados ativos.
- O usuário runtime fornecido pelo CLI mantém as permissões concedidas pela Neon. Antes de expor o frontend publicamente, concluir a separação de credencial administrativa e role restrita conforme o README; este setup não revogou privilégios de uma role existente.

O backup manual cloud mantém uma única cópia, sem agenda, histórico de versões ou garantia de recuperação além da última cópia válida. O comando `neon deploy` provisionou os serviços de backend e não hospedou o frontend.
