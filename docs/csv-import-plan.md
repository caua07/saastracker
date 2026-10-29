# Importação de extratos — investigação e execução

Escopo confirmado: **extrato da conta Inter**, uso pessoal. Redesenhar a importação e separar leitura de dados da interface. Fatura de cartão permanece uma configuração explícita, com sinal de saída revisável. Não há autorização ou necessidade de alterar banco, credenciais ou serviços externos.

## Evidências e problemas

- `src/domain/imports.ts`: Papa Parse usava `header: true` desde a primeira linha; um preâmbulo virava cabeçalho. Erros estruturais eram acumulados, mas a mesma linha ainda podia gerar uma transação.
- `parseAmount`: removia letras isoladas, aceitava pontuação ambígua e não distinguia formato brasileiro de americano. A origem do sinal dependia exclusivamente de um ajuste pouco visível.
- `suggestMapping`: não reconhecia Data Lançamento, Valor (R$), detalhes em Histórico nem colunas separadas de débito/crédito.
- `previewCsv`: busca quadrática por duplicação; crédito era sempre estorno; linhas zero desapareciam sem explicação; número de linha supunha cabeçalho na primeira linha. A classificação estava acoplada ao leitor de CSV e era importada por recorrência.
- `src/components/import-panel.tsx`: seleção assíncrona sem proteção contra corrida, prévia antiga após falha de troca, bloqueio por hash impedia corrigir importações parciais, somente cinco movimentos visíveis, confirmação e erros no fim de um formulário extenso.
- Persistência: `src/components/tracker.tsx` → PUT `/api/workspace` → `workspaceSchema` → `saveWorkspace`. Há autenticação, origem, limite de payload, revisão otimista e transação SQL. Preservar esse caminho; validar o lote antes de chamá-lo. Não migrar o schema.

Não existe extrato real do usuário nos fixtures fornecidos. Layouts de teste são sintéticos. A documentação pública do Inter não oferece um contrato estável de colunas/codificação CSV; reconhecer formatos por evidência e permitir ajustes, sem prometer cobertura universal.

## Arquitetura

`File → bytes/hash/decodificação → CSV estrutural → perfil/mapeamento → valores tipados → classificação → conciliação → prévia → validação do lote → persistência existente`.

- `src/domain/imports/types.ts`: contratos, limites, diagnósticos e resultados por linha.
- `values.ts`: datas estritas e dinheiro decimal, sem float e sem inferência silenciosa de separador ambíguo.
- `csv.ts`: separador, BOM, preâmbulo/cabeçalho, linhas físicas, aspas, rodapés conhecidos e quarentena estrutural.
- `profiles.ts`: aliases e padrões compatíveis com extrato Inter; histórico e descrição complementares, conta/cartão separados.
- `file.ts`: UTF-8, Windows-1252 e UTF-16 com BOM, rejeição de binário, hash e tamanho.
- `preview.ts`: conversão, chaves existentes compatíveis, multiplicidade, IDs conflitantes, exclusão explícita, totais exatos por moeda e evidências.
- `commit.ts`: reavaliação contra workspace atual, confirmação de importação parcial, limites e validação antes de salvar.
- `src/domain/transactions.ts`: normalização/classificação compartilhada, independente de CSV.
- `src/components/imports/*`: estado do fluxo, ajustes e revisão paginada. O domínio não conhece React, DOM, banco ou conta real.
- `src/domain/imports.ts`: fachada compatível para consumidores atuais e exportação CSV de assinaturas.

Sem dependência nova. Papa Parse, Decimal e Zod existentes permanecem. Processar apenas em memória no navegador; enviar somente transações confirmadas. Arquivo original e preâmbulo não vão para o servidor nem para logs.

## UX e direção

Modo **Operate**. Manrope, branco frio/navy e cobalto herdados. Importação em superfície flutuante com foco protegido: arquivo → ajustes → conferência → conclusão. A janela tem cabeçalho fixo, corpo rolável e ação de confirmação ancorada, sem cobrir as últimas linhas. Mobile ocupa a área disponível com margens seguras.

Selecionar ou arrastar um arquivo; indicar leitura; identificar layout compatível sem afirmar certificação do banco. Pedir apenas conta de origem e expor ajustes técnicos progressivamente. Conferência mostra entradas/saídas por moeda, período, contagem de novas/duplicadas/inválidas/ignoradas, todas as linhas por paginação e motivo de exclusão. Erros fatais bloqueiam; erros isolados exigem aceite explícito para importar as válidas. Nunca converter entrada em despesa por omissão invisível.

Trocar arquivo limpa resultado anterior, tentativas concorrentes não se sobrepõem, falha de gravação preserva a revisão, salvar bloqueia duplo clique, sucesso só aparece após persistência. Reimportação parcial é permitida e conciliada por movimento. Duplicação sem ID é aproximada: preservar multiplicidade e explicar a limitação; CSV e Open Finance não são conciliados automaticamente entre si.

## Execução e aceitação

1. **Leitura e valores (M)**: extrair módulos, codificação e formatos. Aceitar UTF-8/BOM/CRLF, Windows-1252, aspas e descrição multilinha, preâmbulo e rodapés documentados nos fixtures. Preservar linhas físicas. Rejeitar data impossível, delimitador/cabeçalho ambíguo, aspas quebradas e precisão/valor fora do contrato.
2. **Conciliação e lote (M)**: IDs e fingerprints compatíveis, multiplicidade, conflito de ID, classificação conservadora, totais e limites. Repetir/sobrepor arquivo não duplica movimentos reconhecíveis; mesma descrição/data/valor repetidos legitimamente são preservados. Testar recuperação de lote parcial, moedas separadas, limite de workspace e persistência recusada.
3. **Fluxo e UI (M)**: componentes por responsabilidade, estado assíncrono protegido, upload por teclado/drag, ajustes, revisão com filtros/paginação, confirmação parcial e ações flutuantes. Critérios: nenhuma gravação antes de confirmar; falha ao trocar arquivo não permite salvar prévia velha; todas as linhas acessíveis; desktop/mobile sem overflow; diálogo com foco/Escape e feedback acessível.
4. **Verificação (M)**: fixtures sintéticos de regressão, unitários do domínio, E2E upload→revisão→banco isolado→reimportação, erros de rede e acessibilidade. Rodar typecheck/lint/test/build e E2E em `saastemics_e2e`, porta 3001. Nunca limpar dados pessoais. Inspeção visual em até duas rodadas agrupadas; revisão independente e registro final dos resultados.

## Limites e decisões

- Exportação bancária sem ID não permite prova absoluta de identidade de dois movimentos idênticos em arquivos com multiplicidades diferentes. Exibir a limitação; não inventar IDs bancários.
- Perfil compatível com Inter é heurístico baseado em cabeçalho. Escolha manual e leitura estrita prevalecem quando o arquivo muda.
- Erros estruturais globais não podem ser contornados com “importar válidas”. Linhas isoladas inválidas podem ser omitidas com aceite.
- Entradas comuns são `income`; estorno exige descrição compatível. Essa opção cabe na coluna `kind` textual existente, sem migration. Backups antigos continuam válidos.
- A pipeline não executa fórmulas, não usa IA, não conecta Gmail nem corrige câmbio automaticamente.

Fontes consultadas em 29/10/2026: [Papa Parse — configuração, erros e metadados](https://www.papaparse.com/docs), [Inter — exportação de extrato PJ](https://ajuda.inter.co/conta-digital-pessoa-juridica/como-acessar-o-extrato-da-conta-digital-pj), [Inter — exportação da Global Account Business](https://ajuda.inter.co/global-account-business/como-visualizo-e-baixo-o-extrato-da-global-account-business-do-inter-empresas). As páginas do Inter comprovam canais de exportação, não um schema de CSV para conta PF.

## Resultado da validação

- Implementadas as quatro fases acima, sem dependência nova, migration, alteração de credenciais ou serviço externo. A fachada existente foi mantida e o CSS antigo da importação foi removido.
- `npm test`: **99 testes, 9 arquivos, aprovados**. Inclui 20 mil registros, Unicode/Windows-1252/UTF-16, linhas físicas, aspas, separadores, cabeçalho após preâmbulo, limites, duplicação e recuperação parcial.
- `npm run test:e2e`: primeira rodada **8/8**; depois de acrescentar o cenário de corrida/falha estrutural, os três cenários de importação e os demais testes funcionais passaram, mas três testes antigos sofreram timeouts prolongados. Repetição direcionada desses três: **3/3 em 12,6 s**, sem mudança de timeout nem código para contornar a falha. Os **9 cenários** foram aprovados ao final.
- E2E comprova upload → revisão → confirmação parcial → banco isolado → recarga; falha 500 sem perda de revisão; arquivo inválido sem prévia antiga; paginação/busca; seleção concorrente; CSV estruturalmente fatal bloqueado; reimportação; retorno de foco; privacidade/origem; desktop/mobile e axe WCAG A/AA sem violações na importação.
- `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check`: aprovados. `npm audit`: **0 vulnerabilidades**.
- Capturas em `.impeccable/review/imports/`: leitura e conferência, desktop e mobile. Revisão independente Impeccable: **ship**, nenhuma correção material. Capturas e fixtures são sintéticos.
- E2E usou somente `saastemics_e2e`, porta 3001. Nenhum dado financeiro pessoal foi alterado. Não houve novo deploy nesta tarefa.
- **Limite de evidência:** o CSV real do proprietário ainda não foi fornecido/testado. Não há promessa de aceitar formatos futuros, documentos corrompidos ou identidade perfeita de movimentos sem ID. Importações antigas não são reescritas automaticamente; correções de dados já salvos exigem revisão explícita.
