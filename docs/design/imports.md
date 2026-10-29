# Importação de extratos

Target: `src/components/import-panel.tsx`, `src/components/imports/`, `src/components/import-dialog.tsx`, `src/components/imports/imports.css`.
Mode: Operate. Usuário único revisando extrato da conta Inter, geralmente depois de uma falha do Open Finance. Objetivo: importar movimentos corretos com controle de direção, valores e duplicações.

## Direction contract

THESIS: uma mesa de conferência financeira: escolher, interpretar e revisar antes de salvar. O formulário técnico deixa de ocupar todo o percurso.

OWN-WORLD: extensão da identidade existente; Manrope local, superfícies claras, navy e cobalto funcional. Janela flutuante de trabalho e barra de decisão elevada; tabela sem cartões aninhados, hierarquia por alinhamento e espaço.

STORY: escolher CSV, reconhecer formato compatível, informar conta, conferir exemplos e ajustar só o necessário. Revisão diferencia novos, existentes, inválidos e ignorados; confirmação explicita o que será salvo. Erros não destroem o trabalho.

FIRST VIEWPORT: janela central com margens no desktop; título e fechamento no topo, sequência compacta, identificação do arquivo, conta de origem e amostras. Na revisão, totais por moeda acima de tabela paginada; ação ancorada no rodapé. Mobile usa a altura dinâmica, sem rolagem horizontal da página e sem ação cobrindo dados.

FORM: extensão local diretamente especificada pelo usuário, sem sorteio de identidade. Interação principal: prévia com inclusão por linha e atualização dos totais; nenhuma animação ornamental. Sem comp de referência; revisão baseada no código e capturas desktop/mobile sintéticas.

FINISH: revisão final independente e registro da extensão nesta especificação de superfície. Disposition final: **ship**, sem correções materiais. A identidade global permanece em `DESIGN.md`; esta extensão local não exige reescrevê-la. Não há raster entregue nesta superfície.

## Estados

Upload inicial, arrastar, leitura, ajustes incompletos, revisão válida, duplicados, importação parcial com aceite, estrutura fatal, zero linhas novas, falha ao salvar, conclusão e repetição. Limites: 10 MB, 20 mil registros por arquivo, 50 linhas visíveis por página. Foco contido/restaurado por Radix; fechamento por Escape, bloqueado apenas durante gravação.

## Extensão implementada e evidências

Conferência documental do código em 29/10/2026. Fontes: `src/app/globals.css`, `src/components/import-dialog.tsx`, `src/components/import-panel.tsx` e `src/components/imports/`. A revisão independente aprovou a entrega; fixtures e capturas da validação são sintéticos. Não houve validação de extrato real do proprietário nem confirmação de cobertura universal do Inter.

### Continuidade com o sistema existente

- A superfície herda Manrope de `--font`, branco de `--surface`, navy de `--ink`, metadados de `--muted` e divisórias de `--line`. Cobalto (`--accent` e `--accent-soft`) continua restrito a ação, seleção e feedback de arraste; estados prontos e inválidos preservam a linguagem verde/vermelha com rótulos textuais.
- As ações reutilizam `Button` e `IconButton`; os ajustes usam os campos globais. Valores da amostra, totais e linhas usam números tabulares. Entradas e saídas têm rótulos, sinais e moeda; os totais ficam separados por moeda.
- A conferência usa linhas com divisórias e alinhamento de descrição, valor e estado. Busca, filtro, paginação e inclusão por linha mantêm a densidade de trabalho sem criar cartões aninhados. Os ajustes técnicos são revelados por um botão com `aria-expanded`.

### Elevação local

A janela central é uma variação local de sobreposição: largura máxima de (880px), raio de (16px) e `--overlay-shadow`, já existente para diálogos. A barra de decisão usa `--shadow-small`, também existente, e raio de (12px). Sua elevação serve à decisão dentro do diálogo; não estabelece sombra para painéis e cards do restante do aplicativo. O corpo rola em uma região própria, enquanto cabeçalho e barra ficam no fluxo flexível fora dessa região, sem sobrepor as linhas.

O diff de `src/app/globals.css` remove apenas estilos da importação anterior; as declarações globais de tokens permanecem preservadas. O novo `imports.css` não declara tokens globais. Scrim, borda tracejada, aviso âmbar e medidas específicas são tratamentos locais da superfície. **Nenhum novo token global é necessário.** Uma eventual promoção exige reutilização real em outras superfícies, sem transformar esta composição em regra universal.

### Adaptação e interação

No desktop, a janela mantém (32px) de margem mínima por lado; a altura máxima considera `100dvh`. Até (767px), preserva (10px) por lado, reduz paddings, empilha os campos e a barra de ações e reorganiza cada movimento em identificação, valor e estado. Campos de busca e seleção usam (16px), e ações da barra têm altura mínima de (44px). Descrições e nomes de arquivo podem quebrar linha.

Radix fornece a base modal; o diálogo registra o elemento de origem para restaurar foco. A mudança de etapa move o foco para o título e retorna o corpo ao início. Erros usam `role="alert"`; avisos de revisão usam `role="status"`. A preferência por movimento reduzido desativa as transições locais. O arquivo pode ser escolhido pelo botão de upload ou por arraste; a conclusão só é exibida após retorno positivo da persistência. Falha ao salvar preserva a conferência, e importar parcialmente exige aceite explícito quando há linhas inválidas.

Esses registros descrevem a implementação observada. Os resultados dos checks e os limites da validação ficam em `docs/csv-import-plan.md`; não representam aprovação de dados bancários reais.
