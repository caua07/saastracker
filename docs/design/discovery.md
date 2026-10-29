# Descoberta — evidência e possibilidades

Modo Operate. Extensão local da coleção existente: mesma Manrope, branco frio, navy, cobalto e linguagem de evidências. Escopo: distinguir calendário observado de serviço possivelmente contratado e tornar explícita a comparação automática entre meses da mesma conta; nenhuma nova identidade visual.

## Direction contract

THESIS: a fila explica o que os dados sustentam; serviço reconhecido não desaparece porque o histórico é curto, e compra repetida não vira assinatura por coincidência.

OWN-WORLD: tokens e componentes existentes, tipografia compacta, espaço e divisórias para separar cobertura, padrões e possibilidades. Sem cartões de métricas nem score numérico na hipótese isolada.

STORY: importar movimentos sem escolher mês, conferir os meses observados por conta, comparar datas reais de cobrança, revisar padrões ou possíveis serviços e confirmar condições reais. Frequência desconhecida aparece como desconhecida; previsão recebe o rótulo de estimativa.

FIRST VIEWPORT: introdução e ação de importar, faixa de cobertura e meses por conta com detalhes progressivos, orientações condicionais; duas filas nomeadas, com contagem e estados vazios honestos. Mobile empilha cabeçalho, badge e ações; as datas refluem sem truncar descrição ou valores.

FORM: correção local guiada por diagnóstico real e testes sintéticos, sem sorteio de identidade ou comp. Interação principal é abrir a evidência e escolher condições, não animação.

FINISH: revisão independente `months_finish_reviewer`, em passe de veredito, com disposição `ship` para esta extensão mensal após resolver a repetição de um ciclo pago antecipadamente. Esse veredito cobre a superfície e o fluxo revisados; não é uma auditoria de todo o aplicativo. Compatibilidade com o DESIGN.md vigente e proveniência das capturas sintéticas registradas abaixo.

## Limites

Nenhuma promessa de identificar planos ausentes do extrato ou cobertura completa do catálogo. A janela e os meses são calculados pelas datas dos movimentos, sem usar o nome do arquivo ou o cabeçalho original descartado. Um mês com movimentos não significa extrato completo; uma lacuna significa mês sem movimentos importados, sem concluir ausência de cobrança. Um pagamento de fatura não informa sua composição. O padrão e sua próxima data permanecem hipóteses até confirmação do proprietário; a data de início do contrato não é inferida.

## Compatibilidade com o sistema existente

Registro de 29/10/2026, comparando a implementação com `PRODUCT.md` e `DESIGN.md`. A descoberta mantém o shell, Manrope local, superfícies claras, divisórias e cobalto das ações existentes. Reutiliza `ServiceLogo`, `Button`, `EmptyState`, o badge de confiança e o formulário de assinatura no `Sheet` Radix; não introduz outra família de controles ou um novo padrão global de card.

`src/components/discovery-panel.tsx` organiza cobertura, avisos e as duas filas. `src/components/discovery.css` contém as extensões locais: na região `.discovery-content`, o texto de confiança baixa usa `--muted` e a confiança alta usa `--success` sobre `--success-soft`. A hipótese de serviço reconhecido mostra “Frequência a confirmar”, sem score numérico, e o valor é rotulado como última cobrança encontrada. Os tokens existentes atendem à superfície; nenhum novo token é necessário.

O histórico por conta usa disclosure nativo, metadados e divisórias. Dentro do card recorrente, a comparação de datas usa algarismos tabulares, datas com peso intermediário e uma grade que se adapta ao espaço. São composições locais dos elementos existentes, sem nova elevação ou família de controles. O score de confiança mantém opacidade integral nesta superfície para preservar contraste. O ajuste anterior no toast faz ícone, ação de desfazer e botão de fechar herdarem sua cor de texto.

`DESIGN.md` e `.impeccable/design.json` permanecem preservados. A comparação desta superfície não exige mudanças nos tokens ou nos exemplos globais do sistema.

## Comparação automática entre meses

- `periods.ts` agrupa movimentos por nome de conta e mês da data (`YYYY-MM`), ordena o histórico e conta meses observados e lacunas. Os arquivos podem chegar fora de ordem ou conter vários meses. Usar o mesmo nome de conta permite reunir os períodos; nomes diferentes permanecem separados.
- Na etapa de mapeamento CSV, a prévia informa os meses detectados nas linhas selecionadas, compara com o histórico da conta e informa quantos meses novos serão acrescentados. O texto de ajuda do campo Conta explica a comparação, e o sucesso da importação explica a reanálise automática. A comparação não exige reimportar movimentos já salvos.
- “Meses identificados automaticamente” mostra cada conta em um disclosure, com quantidade de movimentos por mês e aviso de que a presença de movimentos não garante cobertura completa. O total observado e a janela em dias continuam distintos desse histórico mensal.
- Cada padrão recorrente compara até seis datas reais mais recentes, sem substituir suas datas pelo dia nominal. O resumo informa meses com cobrança, maior desvio em dias e “Próxima no padrão”, marcada como estimada. Todas as evidências continuam no disclosure de movimentos. Uma estimativa já passada pede movimentos recentes para conferir continuidade.
- `cadence.ts` e `schedule.ts` preservam o calendário mensal, trimestral, anual ou semanal. A próxima estimativa parte do próximo ciclo livre após o último ciclo observado: agosto 10 → setembro 11 → outubro 9 prevê novembro 10, pois o pagamento antecipado já ocupa o ciclo de outubro.
- A confirmação de um padrão abre “Data-base observada” com a âncora original trazida do extrato. A próxima cobrança é apresentada separadamente como estimativa; com âncora e frequência inferidas preservadas, também pula o ciclo já observado. Persistir a âncora mantém janeiro 31 → fevereiro 28 → março 31, em vez de fixar o dia 28. A data de início contratual continua sendo decisão do proprietário.

A extensão funciona na reanálise existente, sem worker permanente, dependência nova, schema ou migration. Deduplicação, separação de contas/moedas, confirmação humana e distinção entre evidência e previsão permanecem válidas.

## Comportamento preservado

- A cobertura informa dias e datas dos movimentos observados. O disclosure “Como a análise funciona” explica inclusões, exclusões e limites. Janela curta e pagamento de fatura recebem orientações próprias, sem sugerir sincronização ou descoberta completa.
- “Padrões recorrentes” exige repetição consistente; “Possíveis assinaturas” aceita uma cobrança de serviço reconhecido sem atribuir ciclo. Os estados vazios explicam a insuficiência da evidência.
- Em `subscription-form.tsx`, uma possibilidade reconhecida abre frequência e próxima cobrança vazias. Ambos os campos são obrigatórios; frequência também tem validação no envio. A confirmação continua manual. `tracker.tsx` reutiliza o mesmo fluxo de formulário e vínculo das evidências.
- No breakpoint existente de 767px, o cabeçalho e as ações quebram linha, o badge passa para baixo da identificação, as justificativas ganham entrelinha e os botões da fila têm altura mínima de 44px. Histórico mensal quebra linha e a grade de datas reduz colunas. Descrições de evidência podem ocupar uma linha própria e quebrar palavras, preservando valores e identificação.
- Disclosures usam `details`/`summary` nativos e o foco visível já definido no sistema. O `Sheet` mantém a semântica e a contenção de foco do Radix; ao fechar, restaura o elemento de origem se ele continuar montado. Essa verificação é de código; as capturas estáticas não comprovam navegação por teclado.

## Evidências da entrega

Capturas desta extensão inspecionadas: [desktop](../../.impeccable/review/multi-month/desktop.png) e [mobile](../../.impeccable/review/multi-month/mobile.png). O desktop usa viewport de 1440 × 1100px; o mobile, 390 × 844px; ambas são capturas de página inteira. Mostram a mesma conta sintética com quatro movimentos, três meses observados e janela de 67 dias: Clube de leitura em 10/08, 11/09 e 09/10/2026 como padrão mensal, mais Spotify isolado em 15/10 como possibilidade. O card mostra desvio de até um dia e próxima estimativa em 10/11; o histórico fica aberto e mantém a ressalva de cobertura parcial. A versão estreita preserva datas e ações com reflow.

A origem é o teste “extratos de meses diferentes se cruzam automaticamente e preenchem a data observada”, em `tests/e2e/tracker.spec.ts`. Ele monta três CSVs em memória com nomes sem mês e importa pela interface em ordem outubro → agosto → setembro; o padrão desconhecido só aparece no terceiro período. As capturas são feitas após carregar as fontes, com movimento reduzido. Dados sintéticos exclusivos de teste, no banco `saastemics_e2e` e porta 3001, sem CSV ou dados financeiros pessoais.

O cenário verifica meses novos na prévia, histórico, filas, datas reais, desvio, ausência de overflow horizontal no mobile e Axe WCAG A/AA em desktop/mobile. Em seguida confirma a assinatura com âncora de 10/08/2026, verifica vínculo de três evidências, persistência dos quatro movimentos e três importações, e reabre a página. As imagens registram o estado anterior à confirmação; não demonstram sozinhas persistência, cálculo ou navegação por teclado.

`tests/multi-month-discovery.test.ts` cobre importações fora de ordem, deduplicação, datas irregulares, separação de contas/moedas, lacunas, prévia sem mutação, fim de mês e projeções. A regressão do ciclo antecipado exige novembro 10 mesmo ao confirmar nos dias 9 ou 10 de outubro. A execução final registrada em [discovery-fix.md](../discovery-fix.md) aprovou 138 testes unitários, 11 cenários E2E completos, typecheck, lint e build; Axe encontrou zero violações nos dois tamanhos e `npm audit` reportou zero vulnerabilidades. Este passe documental conferiu fontes, testes, capturas e registro, sem executar novamente a suíte.

A entrega anterior permanece documentada pelas capturas [desktop](../../.impeccable/review/discovery/desktop.png) e [mobile](../../.impeccable/review/discovery/mobile.png), do cenário “Descoberta mostra Spotify isolado como possível e recusa falsos padrões de compras”. Sua conta sintética tem seis movimentos em 30 dias, nenhum padrão e uma possibilidade; cobre aviso de fatura e frequência/próxima data vazias na hipótese isolada. Essa evidência anterior é distinta da validação mensal e do veredito `ship` desta extensão.
