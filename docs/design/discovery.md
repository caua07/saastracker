# Descoberta — evidência e possibilidades

Modo Operate. Extensão local da coleção existente: mesma Manrope, branco frio, navy, cobalto e linguagem de evidências. Escopo: tornar correta e compreensível a distinção entre calendário observado e serviço possivelmente contratado; nenhuma nova identidade visual.

## Direction contract

THESIS: a fila explica o que os dados sustentam; serviço reconhecido não desaparece porque o histórico é curto, e compra repetida não vira assinatura por coincidência.

OWN-WORLD: tokens e componentes existentes, tipografia compacta, espaço e divisórias para separar cobertura, padrões e possibilidades. Sem cartões de métricas nem score numérico na hipótese isolada.

STORY: entender o intervalo observado, conferir alertas de cobertura/fatura, revisar padrões ou possíveis serviços, abrir evidências e confirmar condições reais. Frequência desconhecida aparece como desconhecida.

FIRST VIEWPORT: introdução e ação de importar, faixa de cobertura com detalhes progressivos, orientações condicionais; duas seções nomeadas, com contagem e estados vazios honestos. Mobile empilha cabeçalho, badge e ações sem truncar descrição ou valores.

FORM: correção local guiada por diagnóstico real e testes sintéticos, sem sorteio de identidade ou comp. Interação principal é abrir a evidência e escolher condições, não animação.

FINISH: revisão independente com disposição `ship`, sem correções materiais pendentes; compatibilidade com o DESIGN.md vigente registrada abaixo. Capturas desktop/mobile têm origem em teste sintético identificado, sem dados financeiros pessoais.

## Limites

Nenhuma promessa de identificar planos ausentes do extrato ou cobertura completa do catálogo. A janela é calculada a partir dos movimentos, não do cabeçalho original descartado. Um pagamento de fatura não informa sua composição. O padrão permanece hipótese até confirmação do proprietário.

## Compatibilidade com o sistema existente

Registro de 29/10/2026, comparando a implementação com `PRODUCT.md` e `DESIGN.md`. A descoberta mantém o shell, Manrope local, superfícies claras, divisórias e cobalto das ações existentes. Reutiliza `ServiceLogo`, `Button`, `EmptyState`, o badge de confiança e o formulário de assinatura no `Sheet` Radix; não introduz outra família de controles ou um novo padrão global de card.

`src/components/discovery-panel.tsx` organiza cobertura, avisos e as duas filas. `src/components/discovery.css` contém as extensões locais: na região `.discovery-content`, o texto de confiança baixa usa `--muted` e a confiança alta usa `--success` sobre `--success-soft`. A hipótese de serviço reconhecido mostra “Frequência a confirmar”, sem score numérico, e o valor é rotulado como última cobrança encontrada. Os tokens existentes atendem à superfície; nenhum novo token é necessário.

O ajuste compartilhado de contraste fica restrito ao toast existente: ícone, ação de desfazer e botão de fechar herdam sua cor de texto. Não muda a paleta, os tokens ou as variantes globais de confiança.

## Comportamento preservado

- A cobertura informa dias e datas dos movimentos observados. O disclosure “Como a análise funciona” explica inclusões, exclusões e limites. Janela curta e pagamento de fatura recebem orientações próprias, sem sugerir sincronização ou descoberta completa.
- “Padrões recorrentes” exige repetição consistente; “Possíveis assinaturas” aceita uma cobrança de serviço reconhecido sem atribuir ciclo. Os estados vazios explicam a insuficiência da evidência.
- Em `subscription-form.tsx`, uma possibilidade reconhecida abre frequência e próxima cobrança vazias. Ambos os campos são obrigatórios; frequência também tem validação no envio. A confirmação continua manual. `tracker.tsx` reutiliza o mesmo fluxo de formulário e vínculo das evidências.
- No breakpoint existente de 767px, o cabeçalho e as ações quebram linha, o badge passa para baixo da identificação, as justificativas ganham entrelinha e os botões da fila têm altura mínima de 44px. Descrições de evidência podem ocupar uma linha própria e quebrar palavras, preservando valores e identificação.
- Disclosures usam `details`/`summary` nativos e o foco visível já definido no sistema. O `Sheet` mantém a semântica e a contenção de foco do Radix; ao fechar, restaura o elemento de origem se ele continuar montado. Essa verificação é de código; as capturas estáticas não comprovam navegação por teclado.

## Evidências da entrega

Capturas inspecionadas: [desktop](../../.impeccable/review/discovery/desktop.png) e [mobile](../../.impeccable/review/discovery/mobile.png). Mostram a mesma conta de teste, seis movimentos em uma janela de 30 dias, nenhum padrão recorrente e uma possível assinatura; a versão estreita mantém leitura e ações em uma coluna.

A origem está no teste “Descoberta mostra Spotify isolado como possível e recusa falsos padrões de compras”, em `tests/e2e/tracker.spec.ts`. Ele monta `conta-sintetica.csv` em memória, importa fixtures pela interface e grava as capturas após carregar as fontes, com movimento reduzido. O desktop usa largura de 1440px; o mobile usa viewport de 390 × 844px com captura de página inteira. Não utiliza CSV real nem dados financeiros privados.

O mesmo teste contém verificações de filas, cobertura, aviso de fatura, ausência de frequência presumida, ausência de overflow horizontal no mobile, análise Axe em desktop/mobile e campos de frequência/data vazios antes da confirmação. O resultado dos checks da execução é registrado em `docs/discovery-fix.md`; este brief documenta a compatibilidade visual e a proveniência, sem substituir o relatório de testes.
