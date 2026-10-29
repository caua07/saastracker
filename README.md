# Saastemics

Seu espaço pessoal para ver assinaturas, entender custos e acompanhar próximas cobranças. Next.js/React, TypeScript, PostgreSQL/Drizzle e Better Auth. Fontes e logos servidos pelo próprio aplicativo; sem API de IA, analytics ou serviço de logos.

**Neon configurado em 29/10/2026:** Postgres e Object Storage privado foram provisionados e testados na branch `production` do projeto `calm-math-74999050`. O frontend ainda precisa ser publicado na Vercel e ter o OAuth Google configurado. Consulte [o registro de setup e validação](docs/neon-setup.md). As credenciais estão somente no `.env.local` ignorado pelo Git; não são incluídas neste documento.

## Rodar localmente

Requisitos: Node 22+, npm e PostgreSQL 18 instalado ou Docker com Compose. Nenhuma conta cloud é necessária para desenvolver.

```sh
npm ci
npm run setup:local
npm run dev
```

Abra **http://127.0.0.1:3000** e clique em **Entrar no ambiente local**. O setup cria um banco exclusivamente local na porta 55432, migra as tabelas e gera segredos aleatórios em `.env.local` (ignorado pelo Git). Ele não insere assinaturas fictícias no seu banco. A demonstração pública foi removida a pedido do proprietário em 29/10/2026; `/demo` retorna 404 e o app exige login. Fixtures sintéticas ficam somente em `tests/support/`.

O setup prefere o PostgreSQL em `/opt/homebrew/opt/postgresql@18/bin`; configure `LOCAL_PG_BIN` para outro caminho. Sem esse binário, utiliza `docker compose up -d --wait`. O PostgreSQL de desenvolvimento aceita conexões locais sem senha e fica vinculado a `127.0.0.1`; **não use esse modo em produção**. Não coloque o servidor de desenvolvimento na internet.

O script recusa substituir uma configuração que aponte para banco externo ou outra porta/usuário. Em um banco configurado manualmente, use `npm run db:migrate` e configure o login Google conforme abaixo.

Neste checkout, `.env.local` agora aponta para o Neon. `setup:local` recusará essa configuração para proteger o banco remoto. Uma cópia protegida da configuração local anterior foi preservada em `.local/neon-setup/env.local.before-neon`; não a restaure por cima de alterações posteriores sem revisar. O servidor de desenvolvimento continua vinculado ao loopback.

## O que funciona

- Dashboard com custo mensal equivalente, anual equivalente, composição por serviço, categorias e projeção de cobranças.
- Lista e grade, pesquisa, filtros de categoria/status, ordenação por valor ou próxima data e detalhe da assinatura.
- Cadastro/edição, ciclos mensal/anual/trimestral/semanal, pausa, reativação, cancelamento agendado, arquivo e exclusão.
- BRL/USD, taxa manual com data e subtotais sem conversão quando a taxa estiver ausente.
- Agenda, avisos in-app e histórico de condições com vigência. Não inventa pagamentos a partir de previsões.
- Backup JSON, restauração validada e atômica, exportação CSV e exclusão dos dados financeiros. Backup não contém tokens ou credenciais.
- Backup manual na nuvem: salvar, baixar e excluir uma cópia privada no Neon Object Storage, em Configurações. Cada envio substitui a cópia anterior; restaurar usa o mesmo fluxo validado do arquivo JSON. Excluir os dados financeiros do app não exclui essa cópia independente; use **Excluir cópia**.
- CSV com mapeamento, formato de data/sinais, prévia, erros por linha, deduplicação com multiplicidade, histórico e desfazer lote.
- Descoberta determinística: evidências, score explicado, confirmar/editar, vincular a existente, adiar/descartar e reabrir revisões.
- Adaptador pessoal Meu Pluggy com configuração server-side, paginação v2 validada, staging/checkpoints, consulta retomável e atualização idempotente por chave de origem.
- Interface desktop/mobile, navegação por teclado, foco restaurado nos painéis e respeito a reduced motion.

## Publicar gratuitamente

Hospedagem proposta: **Vercel Hobby + Neon Free**, dentro de suas franquias. O backend Neon indicado pelo proprietário já foi configurado; o deploy do frontend na Vercel permanece pendente. Os passos abaixo também servem para configurar outro ambiente.

1. Crie um banco no Neon Free. Separe a conexão de migração com permissão de DDL e uma conexão runtime com privilégios somente nas tabelas/sequências da aplicação. O runtime não precisa criar ou alterar tabelas.
2. Copie `.env.example` para uma configuração local segura ou cadastre as variáveis diretamente no host. Não exponha segredos com prefixo `NEXT_PUBLIC_` e não os coloque no Git.
3. Defina `DATABASE_URL` para a conexão runtime pooled. As migrations usam `MIGRATION_DATABASE_URL` quando definido; caso contrário, `DATABASE_URL_UNPOOLED` fornecido pelo CLI, e por último `DATABASE_URL` para compatibilidade local. No Neon, use sempre a conexão direta para migrar. A migração não acontece durante um request ou automaticamente no build.
4. Defina `BETTER_AUTH_SECRET` com segredo criptográfico aleatório de pelo menos 32 bytes, `OWNER_EMAIL` com seu e-mail e `BETTER_AUTH_URL` com o endereço HTTPS final. Preserve o segredo para continuar descriptografando tokens OAuth persistidos; rotacione com procedimento controlado.
5. Crie um cliente OAuth Web no Google e configure `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Redirect exato: `https://SEU-DOMINIO/api/auth/callback/google`. O login solicita somente identidade; não solicita leitura de Gmail.
6. Publique o projeto na Vercel, usando o subdomínio gratuito e o plano Hobby. Deixe `LOCAL_DEV_AUTH=false` e não cadastre `LOCAL_OWNER_PASSWORD` em produção. O login local retorna 404 em produção mesmo se a variável tiver sido definida por engano.
7. Entre com a conta permitida, confirme os fluxos e, se desejar, fixe também `OWNER_GOOGLE_SUB` ao subject verificado dessa identidade. Cadastro público, senha pública e linking automático de contas estão desabilitados.
8. Confira quotas de compute/storage, faça um backup e ensaie a restauração. A gratuidade depende das franquias atuais; o aplicativo não ativa upgrades nem serviços pagos.

Para os backups privados, configure também `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` e `AWS_REGION` no host, usando os valores obtidos pelo `neon deploy`. Nenhum deles pode ter prefixo `NEXT_PUBLIC_`. O bucket `assets` é declarado como privado em `neon.ts`. O app mantém `pg`/Drizzle e usa `attachDatabasePool` quando executado na Vercel Fluid; a verificação completa do certificado TLS é explícita nas conexões Neon.

Não há worker permanente nem cron obrigatório. Exemplo **opcional** de agendamento diário na Vercel, depois que a integração bancária tiver sido validada:

```json
{
  "framework": "nextjs",
  "crons": [{ "path": "/api/cron", "schedule": "0 12 * * *" }]
}
```

Defina `CRON_SECRET` no host; o endpoint exige `Authorization: Bearer ...`. O job processa no máximo uma conexão por chamada para respeitar a janela serverless. Para este uso pessoal, mantenha **uma instituição automatizada prioritária**; outras ficam sob demanda. Não há promessa de tempo real, retry externo automático ou sync horário. Sem `CRON_SECRET`, o endpoint recusa chamadas. O `vercel.json` incluído não agenda nenhuma operação.

## Importação CSV de extrato da conta

Em **Conexões → Importar CSV**, selecione ou arraste um arquivo, confira a conta e os exemplos de leitura, depois revise e confirme os movimentos. O fluxo reconhece tabelas compatíveis com o extrato da conta Inter, inclusive com informações antes do cabeçalho e colunas de saldo; outros cabeçalhos podem ser mapeados em **Ajustar leitura**. CSV não tem um formato bancário universal.

A leitura aceita UTF-8, Windows-1252 e UTF-16 com BOM, separadores comuns e campos entre aspas. Valores e totais usam decimal exato. Saldo não é movimento, entrada não é automaticamente estorno e moedas diferentes não são somadas sem conversão. Limites: 10 MB e 20 mil registros por arquivo.

Todas as linhas podem ser consultadas por busca/filtros e paginação. Erros isolados exigem aceite para importar só as válidas; estrutura inválida bloqueia o lote. Você pode retirar movimentos individualmente. O arquivo original não é enviado ao servidor. Importações parciais podem ser retomadas; use sempre o mesmo nome de conta. Sem ID bancário, a conciliação por conteúdo e multiplicidade tem ambiguidades e não une automaticamente CSV com Open Finance.

Arquitetura, problemas encontrados, decisões e evidências: [plano da importação](docs/csv-import-plan.md). Fixtures são sintéticos; nenhum CSV real do proprietário foi validado nesta revisão.

## Falha ao iniciar login Google

O login grava um estado temporário em `auth_verification` antes de redirecionar para o Google. Se a conexão com o banco falhar, a autenticação não chega ao provedor. No incidente de 29/10/2026, os logs de produção mostraram `ENOTFOUND` com hostname `base`: a `DATABASE_URL` da Vercel estava incorreta, apesar de a conexão local Neon funcionar.

Use a URL pooled completa do Neon em `DATABASE_URL` de **Production**, sem incluir o nome da variável no valor. Alterações de ambiente exigem novo deploy. O callback cadastrado no Google deve corresponder a `BETTER_AUTH_URL` + `/api/auth/callback/google`. Nunca envie a connection string ou o Client Secret em prints/logs.

A rota de autenticação normaliza falhas internas para JSON 503 e registra apenas códigos técnicos permitidos, sem parâmetros SQL/OAuth. A interface trata respostas vazias/HTML e permite repetir a tentativa. Os E2E usam credenciais Google fictícias para testar a construção do redirect e a gravação do estado; não simulam aprovação real da conta no Google.

## Meu Pluggy

Esta integração é opcional e **não foi autenticada contra uma conta financeira real**. Para habilitar:

1. Conecte sua instituição no [Meu Pluggy](https://meu.pluggy.ai/).
2. Autorize o conector **MeuPluggy** no Dashboard da Pluggy; guarde o Item ID. Não escolha o conector bancário comercial para este caminho.
3. Cadastre `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` no servidor e reinicie/republique. O formulário web recebe apenas o Item ID, nunca seu segredo ou senha bancária.
4. Abra Conexões, informe o item e consulte. Se houver mais páginas que a execução permita, continue pelo mesmo botão. Dados só entram no histórico após concluir o lote; a página não depende de um processo rodando depois da resposta.
5. Confira Movimentos e Descoberta antes de confiar em números importados. Cota mensal pessoal, entitlement v2, cobertura e semântica de cada emissor precisam ser validados na conta real.

As consultas não apagam transações ausentes: consentimento expirado, listas vazias ou janela limitada nunca eliminam histórico. IDs do provedor e uma chave de conta orientam atualizações; **reconexão de conta e sobreposição CSV/API podem precisar de conciliação manual**. Não existe deduplicação universal entre fontes nem matching documental. Movimentos não vinculados não entram no gasto das assinaturas. O conector preserva a data civil de lançamento fornecida; valide a interpretação com o emissor no piloto. Apenas BRL/USD são importados; registros incompatíveis são contados e informados.

O job preserva estado parcial e recusa publicação com lease inválido. Restaurar backup ou excluir os dados interrompe os jobs locais para que uma execução antiga não republique o lote. Isso não revoga consentimento no banco/Meu Pluggy; revogue por lá separadamente.

## Dados e privacidade

Dados pessoais só são lidos após sessão verificada do proprietário. Mutações exigem mesma origem e a versão atual do workspace; conflitos retornam 409, sem sobrescrever outra aba. O banco publica alterações numa transação. Tokens OAuth access/refresh são criptografados pelo Better Auth, e o aplicativo não inclui tokens em backups/logs.

Não há acesso ao Gmail, OFX/PDF/OCR, treinamento de modelos, detecção de uso real dos serviços ou cancelamento remoto. Essas possibilidades continuam fora do escopo implementado. “Pausar”, “cancelar” ou “excluir” aqui altera seu controle pessoal; não muda a cobrança no fornecedor.

Faça uma exportação JSON semanal e antes de alterações grandes. O MVP não promete backup cloud diário nem RPO de 24 h; a última cópia válida define sua recuperação. A restauração substitui dados, solicita confirmação e não restaura credenciais. A cópia exportada fica sob seu controle: proteja e exclua quando necessário.

O backup na nuvem também é manual, sem histórico de versões. A API exige sessão do proprietário e mesma origem em gravação/exclusão. Credenciais S3 ficam no servidor; não há URLs públicas ou nomes de objetos escolhidos pelo cliente. `neon deploy` mantém a infraestrutura; não publica o frontend Next.js.

## Verificação

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm audit
```

Os E2E criam **saastemics_e2e**, um banco local separado, com seu próprio servidor na porta 3001 e identidade de teste. Eles não limpam o banco pessoal. Use `CHROME_PATH` se o executável Chrome não estiver no caminho padrão do macOS; não há download obrigatório de navegador. O servidor de teste usa `.next-e2e`, separado do app normal.

Validação em 28/10/2026: TypeScript, ESLint, formatação e build de produção aprovados; 25 testes de domínio/segurança e 4 E2E aprovados, incluindo restauração após exclusão, concorrência, importação/reimportação, descoberta, isolamento da demo, acessibilidade automatizada e viewport mobile. `npm audit` retornou zero vulnerabilidades. Isso não substitui o piloto de OAuth/Pluggy com as contas reais.

As migrations estão em `drizzle/`; alterações de schema usam `npm run db:generate`. O override de esbuild atualiza a dependência transitiva antiga do drizzle-kit, sem downgrade do CLI. A geração de migrations é verificada junto aos testes.

## Estrutura

`src/domain`: dinheiro, calendários, validação, CSV e recorrências puros. `src/server`: auth, banco, persistência e adaptadores com segredos server-side. `src/components`: interface. `src/app`: rotas web/API. `tests`: domínio, integração HTTP e E2E. [Plano de pesquisa](docs/subscription-tracker-plan.md) registra a investigação; [PRODUCT.md](PRODUCT.md) registra o escopo atual.

[DESIGN.md](DESIGN.md) e `.impeccable/design.json` documentam os tokens e componentes da interface implementada. A revisão visual independente concluiu **ship** nas capturas desktop/mobile de dashboard, login, detalhe e formulário, sem correções materiais; a avaliação foi feita contra o contrato escrito, sem comp aprovado ou cartão QUALITY BAR disponível.

Logos: [Simple Icons](https://simpleicons.org/), fornecidos pelo pacote `simple-icons` com atribuições/licenças específicas dos fornecedores; não indicam parceria. ChatGPT e AWS usam fallback tipográfico. Tipografia: Manrope, distribuída por `@fontsource-variable/manrope`, licença SIL OFL. Nenhuma imagem de estoque ou raster gerado integra a interface.
