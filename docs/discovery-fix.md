# Descoberta: serviços possíveis e recorrência comprovada por padrão

## Problema verificado

O importador persistia os movimentos, mas a Descoberta só recebia o resultado de `detectRecurrences`. Uma cobrança isolada de um serviço do catálogo nunca aparecia. Em contrapartida, dois movimentos desconhecidos separados por 13 dias podiam encaixar nos slots 0 e 2 de um calendário semanal, com tolerância de dois dias e aderência mínima de 60%. O resultado parecia uma lista de assinaturas, embora a evidência fosse fraca.

A investigação foi feita no código e por consulta **somente leitura** ao workspace existente, com rollback. Confirmou uma janela observada curta, um serviço reconhecido omitido e três grupos desconhecidos de dois eventos apresentados como candidatos. Não foi necessário exportar descrições completas, valores ou dados do proprietário para fixtures/documentação, nem modificar dados no banco.

## Decisões

- `analyzeDiscovery` fornece duas filas: **Padrões recorrentes** e **Possíveis assinaturas**. A segunda aceita um serviço reconhecido sem calendário consistente, com `cycle: null`. Isso é um sinal de revisão, não confirmação de contratação.
- `detectRecurrences` continua disponível como API de padrões estritos. Consumidores atuais e testes preservam a distinção entre uma compra e recorrência.
- Comerciantes desconhecidos exigem pelo menos três períodos, valores próximos e cobertura de pelo menos 75% dos períodos esperados. Semanas exigem quatro cobranças e cobertura de pelo menos 85%, com tolerância de um dia. Um intervalo quinzenal não vira semanal.
- Identidade é separada de calendário em `src/domain/discovery/merchants.ts` e `cadence.ts`. Descrições genéricas e referências bancárias explícitas não criam identidades falsas. Nunca agrupar estabelecimentos só porque o valor coincide.
- Crédito, transferência, parcela, pagamento de fatura, movimento pendente, valor zero e evidência já vinculada continuam fora da seleção.
- O nome do serviço é uma heurística do catálogo existente; não representa detecção universal de fornecedores ou de planos diferentes do mesmo fornecedor. Uma compra digital avulsa também pode aparecer na fila de possíveis.
- Aderência considera períodos ocupados e todos os movimentos do grupo; várias compras no mesmo período reduzem suporte. Há um conjunto limitado de âncoras de calendário para tolerar um movimento inicial fora do padrão, com complexidade linear por grupo e sem busca por centenas de períodos para cada movimento.
- Rejeições continuam ligadas à evidência. O fingerprint legado é preservado até 5 mil caracteres; evidências maiores usam fingerprint compacto e determinístico, somente para controle de revisão. Não é token de segurança.

## Experiência

`src/components/discovery-panel.tsx` extrai a interface do componente principal. Mostra intervalo real entre o primeiro e último movimento, em dias — cruzar dois meses não significa ter dois meses de histórico. Explica a análise em disclosure, destaca janela curta e informa que pagamento de fatura não revela compras detalhadas do cartão.

As filas têm contagens e explicações distintas. Possíveis assinaturas exibem a última cobrança, sem frequência ou projeção presumida. Ao revisar uma possível assinatura, frequência e próxima cobrança ficam vazias e são obrigatórias. Nada é confirmado automaticamente. A evidência original pode ser aberta; adiar, descartar, vincular e reabrir revisões foram preservados.

Os dados já importados são reanalisados em memória; não há necessidade de reimportar, reclassificar lançamentos gravados ou migrar banco. Se os débitos individuais de um cartão não estiverem no arquivo, o aplicativo não consegue deduzi-los do total da fatura.

## Regressões e validação

- Testes sintéticos cobrem cobrança única reconhecida, dois desconhecidos mensais, intervalo de 13 dias, compras quinzenais, semana real, datas no fim do mês, primeiro movimento fora da cadência, dados genéricos, créditos/faturas, zero, valores variáveis, recuperação de revisão e janela curta cruzando dois meses.
- E2E reproduz uma conta sintética com uma cobrança de Spotify, compras comuns e pagamento de fatura: exige zero padrões, uma possível assinatura, contagem de dias correta e confirmação manual de frequência/data. Também verifica persistência, vínculo de evidência e acessibilidade desktop/mobile.
- Reanálise somente leitura com o novo motor confirmou que o serviço reconhecido passa a ser uma possível assinatura sem ciclo e os grupos fracos deixam de ser padrões. Nenhum dado financeiro pessoal foi alterado.
- `npm test`: **124 testes, 10 arquivos, aprovados**. Inclui histórico longo com fingerprint limitado e confiança reduzida quando falta um período.
- E2E: **9 cenários existentes aprovados** na rodada completa; o novo cenário apontou contraste insuficiente em badge/toast, corrigido com tokens existentes e cor herdada. O seletor de teste do campo frequência foi ajustado para o papel acessível; capturas mobile passaram a aguardar o layout estabilizar após resize. O novo cenário foi então **aprovado integralmente (1/1)**, incluindo axe desktop/mobile e persistência. Os **10 cenários** foram validados sem afrouxar checks.
- `npm run build`, `npm run typecheck`, `npm run lint` e `git diff --check`: aprovados. `npm audit`: **0 vulnerabilidades**.
- Capturas válidas sintéticas em `.impeccable/review/discovery/desktop.png` e `mobile.png`; revisão independente Impeccable: **ship**, sem correções materiais. Não houve nova identidade visual nem tokens globais.
- Somente `saastemics_e2e`/porta 3001 recebeu escritas de testes. Servidor e banco temporários de testes encerrados. Nenhuma migration, mudança de credencial ou escrita financeira na produção.
