"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Info,
  ReceiptText,
  ScanSearch,
} from "lucide-react";
import type { Workspace } from "@/domain/model";
import type { Candidate, DiscoveryReport } from "@/domain/recurrence";
import { cycleLabels, dateLabel, money, today } from "@/domain/finance";
import { monthLabel } from "@/domain/discovery/periods";
import { ServiceLogo } from "./brand";
import { Button, EmptyState } from "./ui";
import "./discovery.css";

export function DiscoveryPanel({
  report,
  workspace,
  busy,
  onImport,
  onConfirm,
  onReview,
  onReset,
}: {
  report: DiscoveryReport;
  workspace: Workspace;
  busy: boolean;
  onImport: () => void;
  onConfirm: (candidate: Candidate) => void;
  onReview: (
    candidate: Candidate,
    status: "rejected" | "snoozed",
    subscriptionId?: string,
  ) => void;
  onReset: () => void;
}) {
  function card(c: Candidate) {
    const possible = c.basis === "recognized_service";
    const expected = c.schedule?.nextDate ?? null;
    return (
      <article key={c.key} className="panel candidate">
        <div className="candidate-head">
          <ServiceLogo service={c.service} name={c.name} />
          <div>
            <h3>{c.name}</h3>
            <p>
              {money(c.amount, c.currency)} ·{" "}
              {c.cycle ? cycleLabels[c.cycle] : "última cobrança encontrada"}
            </p>
          </div>
          <span className={`confidence confidence-${c.confidence}`}>
            {possible
              ? "Frequência a confirmar"
              : c.confidence === "high"
                ? "Alta confiança"
                : c.confidence === "medium"
                  ? "Confiança média"
                  : "Mais evidências"}
            {!possible && <span>{c.score}/100</span>}
          </span>
        </div>
        {c.schedule && (
          <div className="candidate-calendar">
            <ol aria-label="Comparação das datas de cobrança">
              {c.evidence.slice(-6).map((t) => (
                <li key={t.id}>
                  <span>{monthLabel(t.date.slice(0, 7))}</span>
                  <time dateTime={t.date}>{dateLabel(t.date)}</time>
                </li>
              ))}
            </ol>
            <p>
              {c.schedule.months.length}{" "}
              {c.schedule.months.length === 1
                ? "mês com cobrança"
                : "meses com cobranças"}{" "}
              · desvio observado de até {c.schedule.maxDeviation}{" "}
              {c.schedule.maxDeviation === 1 ? "dia" : "dias"}
              {expected && (
                <>
                  {" "}
                  · Próxima no padrão:{" "}
                  <time dateTime={expected}>
                    {dateLabel(expected, true)}
                  </time>{" "}
                  (estimada)
                </>
              )}
            </p>
            {expected && expected < today() && (
              <p>
                Essa previsão já passou. Importe movimentos mais recentes para
                conferir se a cobrança continuou.
              </p>
            )}
          </div>
        )}
        <div className="evidence-reasons">
          {c.reasons.map((reason) => (
            <span key={reason}>
              {possible ? <Info size={14} /> : <CheckCircle2 size={14} />}
              {reason}
            </span>
          ))}
        </div>
        <details className="evidence-details">
          <summary>
            Ver {c.evidence.length}{" "}
            {c.evidence.length === 1 ? "movimento" : "movimentos"}
            <ChevronDown size={15} />
          </summary>
          <div>
            {c.evidence.map((t) => (
              <div key={t.id}>
                <span>
                  {dateLabel(t.date, true)}
                  <small>{t.account}</small>
                </span>
                <span>{t.description}</span>
                <strong>{money(t.amount, t.currency)}</strong>
              </div>
            ))}
          </div>
        </details>
        <div className="candidate-actions">
          <Button disabled={busy} onClick={() => onConfirm(c)}>
            <Check size={16} />
            {possible ? "Revisar possível assinatura" : "Confirmar assinatura"}
          </Button>
          {workspace.subscriptions.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary" disabled={busy}>
                  Vincular a existente
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="dropdown-menu" sideOffset={5}>
                  {workspace.subscriptions.map((s) => (
                    <DropdownMenu.Item
                      key={s.id}
                      onSelect={() => onReview(c, "rejected", s.id)}
                    >
                      {s.name}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onReview(c, "snoozed")}
          >
            Adiar
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onReview(c, "rejected")}
          >
            Descartar
          </Button>
        </div>
      </article>
    );
  }
  const coverage = report.coverage;
  return (
    <div className="discovery-content">
      <div className="discovery-intro">
        <ScanSearch size={22} />
        <div>
          <h2>O que seus movimentos mostram.</h2>
          <p>
            Padrões de cobrança e serviços para revisar. Uma sugestão só vira
            assinatura depois da sua confirmação.
          </p>
        </div>
        <Button variant="secondary" onClick={onImport}>
          <FileUp size={16} />
          Importar extrato
        </Button>
      </div>
      {coverage.count > 0 ? (
        <>
          <div className="discovery-coverage">
            <strong>
              {coverage.count} movimentos · janela observada de {coverage.days}{" "}
              dias
            </strong>
            <span>
              {coverage.from?.split("-").reverse().join("/")} a{" "}
              {coverage.to?.split("-").reverse().join("/")}
            </span>
            <details>
              <summary>Como a análise funciona</summary>
              <p>
                {coverage.eligible} saídas podem ser analisadas.{" "}
                {coverage.excluded} movimentos ficam fora por serem entradas,
                transferências, parcelas, faturas, pendentes ou já vinculados.
                Movimentos genéricos sem estabelecimento identificável não geram
                sugestões.
              </p>
              <p>
                Estabelecimentos desconhecidos exigem pelo menos três períodos
                consistentes; o ciclo semanal exige quatro cobranças. Um serviço
                reconhecido pode aparecer como possível assinatura com uma única
                cobrança, sem frequência presumida.
              </p>
              <p>
                A descoberta não comprova contratação nem cancela serviços. O
                score é uma heurística, não uma probabilidade.
              </p>
            </details>
          </div>
          <section
            className="discovery-history"
            aria-labelledby="history-heading"
          >
            <h3 id="history-heading">Meses identificados automaticamente</h3>
            <p>
              As datas dos movimentos juntam extratos da mesma conta, mesmo
              enviados fora de ordem. Cada importação atualiza a análise; não é
              preciso escolher o mês.
            </p>
            {report.history.map((history) => (
              <details key={history.account}>
                <summary>
                  {history.account} · {history.months.length}{" "}
                  {history.months.length === 1
                    ? "mês com movimentos"
                    : "meses com movimentos"}
                </summary>
                <ul>
                  {history.months.map((period) => (
                    <li key={period.month}>
                      <time dateTime={period.month}>
                        {monthLabel(period.month)}
                      </time>
                      <span>
                        {period.count}{" "}
                        {period.count === 1 ? "movimento" : "movimentos"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  {history.missingMonths > 0 && (
                    <>
                      {history.missingMonths}{" "}
                      {history.missingMonths === 1
                        ? "mês sem movimentos"
                        : "meses sem movimentos"}{" "}
                      entre o primeiro e o último registro.{" "}
                    </>
                  )}
                  Ter movimentos em um mês não garante que o extrato esteja
                  completo. Use o mesmo nome de conta ao importar outros
                  períodos.
                </p>
              </details>
            ))}
          </section>
          {coverage.days < 60 && (
            <p className="discovery-context">
              <Info size={17} />
              <span>
                O histórico cobre uma janela curta. Para reconhecer
                mensalidades, importe mais períodos da mesma conta; serviços
                reconhecidos já podem aparecer abaixo.
              </span>
            </p>
          )}
          {coverage.invoicePayments > 0 && (
            <p className="discovery-context">
              <ReceiptText size={17} />
              <span>
                Há pagamento de fatura no extrato. Esse total não revela os
                serviços pagos no cartão; para analisá-los, importe as compras
                detalhadas do cartão.
              </span>
            </p>
          )}
          <section
            className="discovery-section"
            aria-labelledby="recurring-heading"
          >
            <header>
              <h2 id="recurring-heading">
                Padrões recorrentes <span>{report.recurring.length}</span>
              </h2>
              <p>
                Cobranças com repetição consistente no calendário. Confira o
                serviço antes de confirmar.
              </p>
            </header>
            {report.recurring.length ? (
              <div className="candidate-list">{report.recurring.map(card)}</div>
            ) : (
              <p className="discovery-quiet-empty">
                Nenhum padrão com evidência suficiente neste histórico. Isso não
                significa que você não tenha assinaturas.
              </p>
            )}
          </section>
          <section
            className="discovery-section"
            aria-labelledby="possible-heading"
          >
            <header>
              <h2 id="possible-heading">
                Possíveis assinaturas <span>{report.possible.length}</span>
              </h2>
              <p>
                Serviços reconhecidos, ainda sem comprovação de recorrência.
                Podem ser compras avulsas.
              </p>
            </header>
            {report.possible.length ? (
              <div className="candidate-list">{report.possible.map(card)}</div>
            ) : (
              <p className="discovery-quiet-empty">
                Nenhum outro serviço do catálogo foi reconhecido entre os
                movimentos elegíveis. Você pode cadastrar manualmente serviços
                que não aparecem no extrato.
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="panel">
          <EmptyState
            icon={<ScanSearch size={30} />}
            heading="Vamos encontrar seus serviços"
            action={
              <Button variant="secondary" onClick={onImport}>
                <FileUp size={16} />
                Importar extrato CSV
              </Button>
            }
          >
            Importe movimentos da conta ou as compras detalhadas do cartão.
            Quanto maior o histórico, melhor a evidência de recorrência.
          </EmptyState>
        </div>
      )}
      {workspace.decisions.length > 0 && (
        <div className="review-history">
          <span>
            <CheckCheck size={16} />
            {workspace.decisions.length} sugestões revisadas
          </span>
          <Button variant="ghost" disabled={busy} onClick={onReset}>
            Reabrir revisões
          </Button>
        </div>
      )}
    </div>
  );
}
