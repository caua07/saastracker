# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Aplicativo web pessoal implementado, adequado a desktop e mobile.

## Stack

Implementado em TypeScript, Next.js, PostgreSQL, Drizzle e Better Auth. Hospedagem recomendada: Neon Free e Vercel Hobby, ainda não configurada. Meta de custo recorrente: R$ 0, dentro das franquias gratuitas, sem serviço pago obrigatório. Não preparar infraestrutura para vender o produto. Execução e limitações no [README](README.md); pesquisa em [docs/subscription-tracker-plan.md](docs/subscription-tracker-plan.md). Implementação autorizada pelo usuário em “Implementa tudo”.

## Users

Um único usuário: o proprietário, que paga por SaaS, desenvolvimento, IA, infraestrutura e outros serviços digitais, especialmente em BRL e USD. Uso exclusivamente pessoal; não há objetivo de vender, atender clientes externos ou evoluir para SaaS comercial.

## Product Purpose

Facilitar a consulta e a organização das próprias assinaturas em uma interface excepcionalmente bem desenhada. Mostrar custos e cobranças futuras com clareza. Automatizar descoberta é desejável depois que a experiência principal estiver útil; não bloqueia a primeira versão.

## Positioning

Uma ferramenta pessoal prazerosa de abrir e simples de manter, com identidade visual marcante, serviços reconhecíveis, números claros e interações cuidadas. Design e qualidade de execução são a prioridade principal. Automação futura deve ser interpretável e proporcional ao benefício pessoal.

## Operating Context

Revisão de gastos e renovações; conciliação entre cartões, contas e serviços; descoberta de cobranças esquecidas. O proprietário pode conectar instituições, importar arquivos e complementar dados manualmente.

## Capabilities and Constraints

- Exclusivamente pessoal, sem billing próprio, planos comerciais, multi-tenancy ou preparação para comercialização.
- Sem opção ou rota pública de demonstração, conforme pedido do proprietário em 29/10/2026. Dados sintéticos são exclusivos dos testes; o app exige autenticação.
- Hospedagem gratuita como restrição: R$ 0 recorrente dentro dos planos gratuitos; não contratar serviços ou fazer upgrade automático.
- Entregue: dashboard, lista/grade/detalhe, cadastro/edição, ciclos mensal/anual/trimestral/semanal, BRL/USD, próximas cobranças, pesquisa/filtros, backup/restauração, importação CSV e descoberta determinística.
- Adaptador Meu Pluggy opcional implementado; validação com instituição real depende de credenciais e cobertura. Gmail, OFX/PDF e alertas externos continuam fora do escopo implementado.
- Design visual e interação devem receber a maior atenção na primeira entrega; funcionalidades básicas não justificam uma arquitetura operacional extensa.
- Cadastro manual, descoberta, histórico, projeções, categorias, pesquisa e alertas fazem parte da visão.
- Open Finance fornece evidências financeiras; não constitui um catálogo completo de assinaturas.
- Separar gasto registrado, custo recorrente mensal equivalente e previsão de cobranças.
- BRL e USD são prioritários; manter moeda original e origem de qualquer conversão.
- Confirmação humana decide a existência e as condições de uma assinatura inferida.
- Gmail é uma possibilidade a avaliar, não uma integração já autorizada ou configurada.
- Nenhuma promessa de descoberta completa, detecção de uso real dos serviços ou cancelamento automático.
- Implementação autorizada. Publicação cloud e validação das contas reais dependem da configuração do proprietário; não ativar serviços pagos.

## Evidence on Hand

Brief detalhado fornecido pelo usuário e pesquisa oficial documentada no plano. Em 28/10/2026, a pasta do projeto estava vazia e não havia Git, código, dados financeiros, logos, identidade visual ou dependências. Não inventar assinaturas reais do proprietário nem resultados de testes com suas instituições.

## Product Principles

1. Valores rastreáveis até suas evidências e regras de cálculo.
2. Automação reversível, interpretável e sujeita a revisão.
3. Informação faltante aparece como desconhecida, não como zero.
4. Coletar e armazenar somente o necessário.
5. Priorizar qualidade visual, facilidade de uso e manutenção pequena, dentro da hospedagem gratuita.

## Brand Commitments

O usuário pediu “design super irado” e o estabeleceu como prioridade. A execução adotou coleção clara com agenda integrada, tipografia Manrope, logos e cobalto nas ações. Esses são fatos da implementação, sem afirmar que o usuário escolheu uma paleta específica ou estabeleceu uma preferência permanente.

## Deliberately Undecided

As instituições/cartões reais e os provedores prioritários ainda não foram informados; só serão necessários na fase opcional de automação. Orçamento recorrente definido: gratuito. Direção implementada: coleção clara com agenda integrada, fonte Manrope local e cobalto de ação. Contrato de superfície em docs/design/dashboard.md; os tokens reais são registrados em DESIGN.md. Nenhuma preferência global de workflow visual foi inventada.
