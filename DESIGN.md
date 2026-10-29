---
name: Saastemics
description: Coleção pessoal de assinaturas, com custos claros e próximas cobranças.
colors:
  canvas: "#f7f8fc"
  surface: "#fff"
  ink: "#202739"
  muted: "#5f6b82"
  faint: "#8a93a5"
  line: "#e9ecf3"
  accent: "#4659dd"
  accent-hover: "#3548c8"
  accent-soft: "#edf0ff"
  success: "#216e54"
  success-soft: "#eaf6f0"
  danger: "#b73746"
  warning: "#946019"
  focus: "#6879f0"
  secondary-ink: "#485269"
  secondary-border: "#dce1ec"
  secondary-hover: "#f6f7fc"
  ghost-hover: "#f0f2f8"
  danger-soft: "#fff0f1"
  danger-hover: "#ffe1e5"
  field-border: "#dde3ee"
  field-label: "#58667f"
  control-muted: "#66728a"
typography:
  display:
    fontFamily: '"Manrope Variable", Manrope, Arial, sans-serif'
    fontSize: "53px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  financial:
    fontFamily: '"Manrope Variable", Manrope, Arial, sans-serif'
    fontSize: "41px"
    fontWeight: 750
    lineHeight: 1.45
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Manrope Variable", Manrope, Arial, sans-serif'
    fontSize: "27px"
    fontWeight: 750
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Manrope Variable", Manrope, Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 750
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Manrope Variable", Manrope, Arial, sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: '"Manrope Variable", Manrope, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  status: "4px"
  tag: "5px"
  control: "7px"
  field: "8px"
  button: "9px"
  menu: "10px"
  service-card: "11px"
  radius: "14px"
  dialog: "16px"
spacing:
  button-gap: "8px"
  toolbar-gap: "10px"
  heading-gap: "12px"
  dashboard-gap: "23px"
  content-inline: "36px"
  sheet-inline: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "8px 10px"
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  status-active:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.status}"
    padding: "2px 6px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.radius}"
  search:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "35px"
  financial-overview:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.radius}"
    padding: "25px 27px 0"
---

# Design System: Saastemics

## Overview

**Creative North Star: "Coleção pessoal, sob controle"**

A coleção pessoal é a metáfora de trabalho desta implementação: serviços reconhecíveis, números bem alinhados e espaço para conferir cada compromisso. Branco frio, tinta navy e cobalto tornam o conjunto leve e preciso. A personalidade vem da tipografia, das marcas dos serviços e da composição, com ornamentação contida.

Uma única família tipográfica aproxima acesso, coleção, agenda, detalhes e formulários. Superfícies claras e divisórias discretas sustentam a leitura; o cobalto orienta ações e seleção. O sistema foi extraído do código entregue, sem comp visual de referência ou QUALITY BAR card fornecido; o julgamento de acabamento é relativo à direção registrada em `docs/design/dashboard.md`.

**Key Characteristics:**

- Branco frio e navy, com cobalto em ação e seleção.
- Manrope local, hierarquia firme e números tabulares.
- Marcas reconhecíveis, com monograma quando não há ícone disponível.
- Superfícies delimitadas por tom e linha; sombra concentrada em sobreposições.
- Reflow mobile que preserva identificação, custo e ações.

## Colors

A paleta combina neutros frios com cobalto funcional; cores de estado e de marca têm papéis próprios. Os valores normativos estão no frontmatter, extraídos de `src/app/globals.css`.

### Primary

- **Cobalto de ação** (`accent`): ação principal, marca Saastemics e seleção ativa.
- **Cobalto pressionado** (`accent-hover`): hover da ação principal.
- **Lavanda funcional** (`accent-soft`): fundos de navegação selecionada, filtros e menus destacados.
- **Periwinkle de foco** (`focus`): contorno de teclado, com afastamento para não depender só de uma mudança de fundo.

### Neutral

- **Branco frio** (`canvas`) e **branco de superfície** (`surface`): diferenciam o plano da página de painéis e navegação.
- **Tinta navy** (`ink`): títulos, valores e texto principal. **Ardósia de apoio** (`muted`, `control-muted`) organiza metadados e controles.
- **Névoa** (`faint`) e **linha fria** (`line`): detalhes discretos e separação entre regiões; não substituem o contraste do texto principal.
- `secondary-ink`, `secondary-border`, `secondary-hover`, `ghost-hover`, `field-border` e `field-label` registram os tratamentos realmente usados em botões e campos, sem convertê-los em uma nova escala de cores.

Verde (`success`, `success-soft`) indica assinatura ativa; vermelho (`danger`, `danger-soft`, `danger-hover`) serve ações destrutivas e erro. Âmbar (`warning`) é semântico. Estados pausado/arquivado/cancelado e trial têm tratamentos específicos no stylesheet; não são cores de marca. Logos e gráficos por serviço podem usar cores próprias do catálogo.

**The Action Cobalt Rule.** Use cobalto para ação, foco e seleção; os logos dos serviços preservam suas cores próprias.

## Typography

**Display Font:** Manrope Variable, com Manrope, Arial e sans-serif como fallback.

**Body Font:** a mesma família, carregada localmente por `@fontsource-variable/manrope` em `src/app/layout.tsx`.

**Character:** sans de produto com presença e curvas limpas. Pesos intermediários dão precisão sem transformar a interface numa grade de títulos pesados.

### Hierarchy

- **Display:** título de acesso, com entrelinha compacta e tracking negativo; adapta o tamanho nos breakpoints do login.
- **Financial:** total mensal equivalente. Usa `font-variant-numeric: tabular-nums`; os tamanhos variam com o espaço disponível.
- **Headline:** título principal da área autenticada; reduz no mobile.
- **Title:** cabeçalho de painel; sheets usam um título maior próprio.
- **Body:** base global. Parágrafos usam entrelinha (1.7), enquanto textos de apoio podem ser menores conforme o contexto.
- **Label:** botão padrão. Labels de formulário usam (12px), peso (650); inputs usam (13px), peso (500), e sobem para (16px) em telas estreitas.

Os papéis são um mapa das regras existentes, não uma escala matemática. Não há família mono separada. Rótulos curtos em caixa alta são reservados a marcadores de seção e tabela; não são o padrão de todo botão.

**The Financial Legibility Rule.** Use algarismos tabulares nos totais financeiros e mantenha moeda e periodicidade próximas ao valor.

## Layout

O shell desktop possui rail fixo (210px), barra superior (65px) e conteúdo com largura máxima (1520px), centralizado na área restante. O padding lateral padrão é (36px). O dashboard atual coloca conteúdo flexível ao lado de uma agenda de (292px), com gap (23px). Essa é a expressão desta superfície; outras páginas podem organizar o mesmo sistema conforme a tarefa.

Os breakpoints existentes são (1500px), (1200px), (1000px), (767px) e (560px). Em telas amplas, rail e respiros crescem. Até (1000px), a agenda desce para uma região de duas colunas. Até (767px), o rail vira menu sobreposto, o conteúdo perde a margem lateral do shell e o login mostra uma coluna. Até (560px), a agenda empilha e a coleção reduz colunas, mantendo serviço, custo e ação. Detalhes completos continuam acessíveis no painel lateral.

Os espaçamentos do frontmatter são valores observados, não uma escala universal imposta. Painéis compartilham alinhamentos internos, mas admitem padding próprio: cabeçalhos padrão (21px 23px 0), resumo financeiro (25px 27px 0), corpo de sheet (27px 28px 36px). O login usa duas metades no desktop e esconde a ilustração de produto no mobile.

## Elevation & Depth

O sistema combina superfícies tonais e linhas finas com elevação seletiva. Painéis, resumo financeiro e cards não recebem sombra externa em repouso. Menus, toast, confirmação e sheets precisam se separar do conteúdo que cobrem. O preview do login tem sombras próprias da composição demonstrativa, sem virar tratamento padrão de todo card.

### Shadow Vocabulary

- **Pequena sobreposição** (`--shadow-small`): menu e toast; valor exato no sidecar.
- **Confirmação** (`--overlay-shadow`): diálogo modal; valor exato no sidecar.
- **Sheet lateral:** sombra orientada para a esquerda, registrada no sidecar.
- **Borda interna secundária:** o botão secundário usa sombra interna como traço, não como elevação.

**The Overlay Depth Rule.** Painéis de conteúdo usam superfície e borda; menus, sheets e confirmações recebem a profundidade necessária à sua sobreposição.

Movimento é breve e funcional: botões transitam em (0.18s), menus entram em (0.16s), sheets em (0.3s). A curva `--ease` é usada nas entradas e no reflow animado do menu mobile. `prefers-reduced-motion` reduz animações e transições; não introduzir movimento obrigatório para compreender estado.

## Shapes

Retângulos suavemente arredondados são a forma dominante. O raio principal pertence aos painéis; controles, botões, logos, menus e tags têm raios menores registrados no frontmatter. Bordas de (1px) separam superfícies sem competir com os dados. Círculos pequenos indicam estado, contagem temporal ou presença; avatares de perfil são circulares.

O sheet encosta na borda direita e não recebe o raio de um card flutuante. O diálogo de confirmação é centralizado, mais arredondado e com largura contida. Logos usam contêiner com overflow oculto; não deformar sua proporção. O tamanho do logo varia por contexto e pelo reflow.

## Components

### Buttons

Compactos, claros e confiantes. `Button` oferece `primary`, `secondary`, `ghost` e `danger`; `busy` adiciona spinner e desabilita a ação. O botão padrão tem altura mínima (40px), padding do frontmatter e peso da role `label`. O secundário recebe borda interna; ghost mantém fundo transparente em repouso; danger usa fundo vermelho suave.

Hover muda o fundo conforme a variante. Ao pressionar, o botão habilitado desce (1px). Foco de teclado usa contorno (3px) com offset (3px). Desabilitado usa opacidade (0.55) e cursor de indisponibilidade. Icon buttons têm label acessível, área padrão de (32px) e raio próprio; o layout pode ajustar a área segundo o contexto.

### Chips

Tags de status são compactas, textuais e sem interação própria. Ativa usa verde suave com ponto em `currentColor`; estados inativos usam neutro e trial usa âmbar suave. A tag auxiliar é neutra. Um chip não deve depender apenas da cor para explicar seu significado.

### Cards / Containers

Painel branco com borda fria e raio principal. Cabeçalho e conteúdo aplicam seus próprios paddings; não aplicar padding global a todo painel. O card de assinatura em visualização de grade possui raio menor, padding (15px) e hover com borda mais azul e fundo quase branco; suas ações são botões reais, acessíveis por teclado.

### Inputs / Fields

Labels acima do campo com gap (7px), borda fria, fundo branco, raio de campo e altura mínima (42px). Foco usa contorno (2px) com offset (1px). Texto de ajuda usa peso (500) e entrelinha (1.8). Não foi implementada uma variante universal de borda de erro: mensagens e feedback seguem os componentes de formulário existentes. A busca é um controle próprio (35px), com foco no contêiner e atalho de teclado quando há espaço.

### Navigation

Navegação lateral em linhas arredondadas, com ícone, texto e estado ativo. Hover usa fundo quase branco; ativo usa lavanda, cobalto e peso (750), com indicador adicional. O menu mobile desliza sobre scrim e preserva o mesmo vocabulário visual. Menus de ação usam primitives Radix com item destacado por fundo suave e texto cobalto.

### Financial overview & sheets

O resumo financeiro combina total dominante, métricas secundárias e faixa de composição por serviço. Valores originais, conversões e ausência de cotação recebem seus rótulos; o total visual não apaga a origem do número. A agenda usa alinhamento temporal e marcas de serviço, sem depender de uma cor para identificar a cobrança.

Sheets de detalhe e formulário usam largura máxima de (500px) ou (660px) na variante ampla, com rolagem do corpo e cabeçalho separado. No mobile ocupam até a largura inteira e altura de viewport dinâmica. A implementação Radix fornece semântica de diálogo, contenção e restauração de foco. Os exemplos do sidecar são amostras visuais; não substituem esse comportamento de aplicação.

## Do's and Don'ts

### Do:

- Do reutilizar os tokens reais do frontmatter e o CSS de origem ao criar novas superfícies.
- Do preservar foco visível, rótulos acessíveis e a preferência por movimento reduzido.
- Do usar marcas de serviço autênticas quando disponíveis e monogramas honestos como fallback.
- Do testar a leitura de nome, moeda, periodicidade e ação no reflow mobile.
- Do distinguir demonstração, informação desconhecida e evidência financeira por texto, além da cor.

### Don't:

- Don't introduzir uma segunda família tipográfica sem uma decisão explícita de identidade.
- Don't elevar todos os painéis com sombras de diálogo ou menu.
- Don't substituir logos por símbolos genéricos quando o catálogo já possui o ícone.
- Don't tratar a distribuição coleção + agenda desta tela como composição obrigatória de todas as páginas.
- Don't comunicar integração sincronizada, custo zero ou dado real quando não existe evidência correspondente.
