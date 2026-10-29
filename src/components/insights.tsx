"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Layers3,
  Info,
} from "lucide-react";
import Decimal from "decimal.js";
import type { Workspace, Subscription } from "@/domain/model";
import {
  overview,
  money,
  monthly,
  convert,
  today,
  addDays,
  parseDay,
  dateLabel,
  dayDiff,
} from "@/domain/finance";
import { ServiceLogo } from "./brand";
import { IconButton } from "./ui";

const chartColors = [
  "#4D5EE8",
  "#8F9AF2",
  "#B2BCF8",
  "#7786DE",
  "#D3DAFC",
  "#8995B9",
  "#52679F",
  "#AEBBE0",
];
export function FinancialOverview({
  workspace,
  onSettings,
  onInfo,
}: {
  workspace: Workspace;
  onSettings: () => void;
  onInfo: () => void;
}) {
  const stats = overview(workspace),
    hasData = workspace.subscriptions.length > 0;
  const parts = stats.active
    .map((s) => ({
      subscription: s,
      value: convert(
        monthly(s.amount, s.cycle),
        s.currency,
        workspace.preferences,
      ),
    }))
    .filter(
      (p): p is { subscription: Subscription; value: Decimal } =>
        p.value !== null && p.value.gt(0),
    );
  const missing = Object.entries(stats.unconverted).filter(([, value]) =>
    value.gt(0),
  );
  return (
    <section className="financial-overview" aria-label="Resumo financeiro">
      <div className="overview-top">
        <div className="main-cost">
          <span className="metric-label">
            Custo mensal equivalente{" "}
            <IconButton label="Entender os cálculos" onClick={onInfo}>
              <Info size={14} />
            </IconButton>
          </span>
          <div className="cost-number">
            {hasData && !(stats.total.isZero() && missing.length) ? (
              money(stats.total, workspace.preferences.baseCurrency)
            ) : (
              <span className="no-cost">—</span>
            )}
            <span>/mês</span>
          </div>
          {missing.length > 0 ? (
            <button className="missing-fx" onClick={onSettings}>
              +{" "}
              {missing
                .map(([currency, value]) =>
                  money(value, currency as "BRL" | "USD"),
                )
                .join(" + ")}{" "}
              sem conversão <ArrowUpRight size={13} />
            </button>
          ) : (
            <span className="metric-caption">
              O custo dos seus serviços, distribuído por mês.
            </span>
          )}
        </div>
        <div className="secondary-metrics">
          <div>
            <span className="metric-label">Equivalente anual</span>
            <strong>
              {hasData && !(stats.total.isZero() && missing.length)
                ? money(stats.annual, workspace.preferences.baseCurrency)
                : "—"}
            </strong>
            <span className="metric-caption">
              {missing.length
                ? "Parcial · há valores sem conversão"
                : "Mantendo os planos atuais"}
            </span>
          </div>
          <div>
            <span className="metric-label">Assinaturas ativas</span>
            <strong>
              {stats.active.length.toString().padStart(2, "0")}
              <span className="metric-unit"> serviços</span>
            </strong>
            <span className="metric-caption">
              {workspace.subscriptions.filter((s) => s.status === "trial")
                .length
                ? `${workspace.subscriptions.filter((s) => s.status === "trial").length} em período de teste`
                : "Seu stack em um só lugar"}
            </span>
          </div>
        </div>
      </div>
      <div className="cost-composition" aria-label="Composição do custo mensal">
        {parts.length ? (
          parts.map((p, i) => (
            <span
              key={p.subscription.id}
              style={{
                flex: p.value.div(stats.total).toNumber(),
                background: chartColors[i % chartColors.length],
              }}
              title={`${p.subscription.name}: ${money(p.value, workspace.preferences.baseCurrency)}/mês`}
            >
              <span className="sr-only">
                {p.subscription.name}:{" "}
                {money(p.value, workspace.preferences.baseCurrency)} por mês.
              </span>
            </span>
          ))
        ) : (
          <span className="empty-composition" />
        )}
      </div>
      <div className="overview-foot">
        <div className="service-stack">
          {stats.active.slice(0, 6).map((s) => (
            <ServiceLogo
              key={s.id}
              service={s.service}
              name={s.name}
              size={24}
            />
          ))}
          <span>
            {stats.active.length
              ? `${new Set(stats.active.map((s) => s.category)).size} categorias no seu dia a dia`
              : "Adicione seu primeiro serviço para começar"}
          </span>
        </div>
        <button className="fx-note" onClick={onSettings}>
          {workspace.preferences.usdBrl ? (
            <>
              US$ 1 = {money(workspace.preferences.usdBrl)}{" "}
              <span>· cotação manual</span>
            </>
          ) : (
            <>
              BRL e USD <span>· definir cotação</span>
            </>
          )}
          <ArrowUpRight size={12} />
        </button>
      </div>
    </section>
  );
}

export function UpcomingPanel({
  workspace,
  onOpen,
  onCalendar,
}: {
  workspace: Workspace;
  onOpen: (s: Subscription) => void;
  onCalendar: () => void;
}) {
  const [week, setWeek] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const stats = overview(workspace),
    day = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i + week * 7));
  const items = stats.upcoming
    .filter((e) => !selected || e.date === selected)
    .slice(0, 4);
  return (
    <section className="panel upcoming-panel">
      <div className="panel-heading">
        <h2>Próximas cobranças</h2>
        <span className="subtle-icon">
          <CalendarDays size={17} />
        </span>
      </div>
      <div className="calendar-week-title">
        <span>
          {new Intl.DateTimeFormat("pt-BR", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(parseDay(days[0]))}
        </span>
        <div>
          <IconButton
            label="Semana anterior"
            onClick={() => {
              setWeek((w) => w - 1);
              setSelected(null);
            }}
          >
            <ChevronLeft size={15} />
          </IconButton>
          <IconButton
            label="Próxima semana"
            onClick={() => {
              setWeek((w) => w + 1);
              setSelected(null);
            }}
          >
            <ChevronRight size={15} />
          </IconButton>
        </div>
      </div>
      <div className="week-strip">
        {days.map((d) => {
          const has = stats.upcoming.some((e) => e.date === d);
          return (
            <button
              key={d}
              onClick={() => setSelected(selected === d ? null : d)}
              className={`${selected === d ? "selected" : !selected && d === day ? "today" : ""}`}
              aria-pressed={selected === d}
              aria-label={`Cobranças em ${dateLabel(d)}`}
            >
              <span>
                {new Intl.DateTimeFormat("pt-BR", {
                  weekday: "short",
                  timeZone: "UTC",
                })
                  .format(parseDay(d))
                  .replace(".", "")
                  .slice(0, 3)}
              </span>
              <strong>{parseDay(d).getUTCDate()}</strong>
              <i className={has ? "has-billing" : ""} />
            </button>
          );
        })}
      </div>
      {selected && (
        <button className="clear-day" onClick={() => setSelected(null)}>
          Mostrar todas as próximas cobranças
        </button>
      )}
      <div className="upcoming-items">
        {items.length ? (
          items.map(({ subscription: s, date }) => (
            <button
              className="upcoming-item"
              key={s.id}
              onClick={() => onOpen(s)}
            >
              <ServiceLogo service={s.service} name={s.name} size={34} />
              <span className="upcoming-info">
                <strong>{s.name}</strong>
                <span>
                  {dayDiff(date, day) === 0
                    ? "Hoje"
                    : dayDiff(date, day) === 1
                      ? "Amanhã"
                      : dateLabel(date, true)}
                </span>
              </span>
              <span className="upcoming-cost">
                {money(s.amount, s.currency)}
                <span>
                  {s.status === "trial" ? "Após o trial" : "Estimado"}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="small-empty">
            {selected
              ? "Nenhuma cobrança prevista neste dia."
              : "As próximas datas aparecerão aqui quando você adicionar assinaturas."}
          </p>
        )}
      </div>
      <button className="panel-link" onClick={onCalendar}>
        Ver agenda completa <ArrowUpRight size={15} />
      </button>
    </section>
  );
}

export function CategoriesPanel({
  workspace,
  onCategory,
}: {
  workspace: Workspace;
  onCategory: (category: string) => void;
}) {
  const stats = overview(workspace);
  return (
    <section className="panel categories-panel">
      <div className="panel-heading">
        <h2>Por categoria</h2>
        <Layers3 size={17} className="subtle-icon" />
      </div>
      {stats.categories.length ? (
        <div className="category-bars">
          {stats.categories.map((c, i) => (
            <button key={c.name} onClick={() => onCategory(c.name)}>
              <span className="category-bar-label">
                <span>
                  <i
                    style={{ background: chartColors[i % chartColors.length] }}
                  />
                  {c.name}
                </span>
                <strong>
                  {c.missing && c.total.isZero()
                    ? "Sem cotação"
                    : money(c.total, workspace.preferences.baseCurrency)}
                  {c.missing && !c.total.isZero() ? " + FX pendente" : ""}
                </strong>
              </span>
              <span className="bar-track">
                <span
                  style={{
                    width: `${stats.total.isZero() ? 0 : c.total.div(stats.total).mul(100).toNumber()}%`,
                    background: chartColors[i % chartColors.length],
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="small-empty">
          Organize seus serviços por categoria para entender a distribuição.
        </p>
      )}
      <p className="panel-caption">
        Custo mensal equivalente · valores convertidos quando há cotação.
      </p>
    </section>
  );
}

export function ProjectionPanel({ workspace }: { workspace: Workspace }) {
  const stats = overview(workspace),
    max = Decimal.max(1, ...stats.projection.map((p) => p.amount));
  return (
    <section className="panel projection-panel">
      <div className="panel-heading">
        <div>
          <h2>Olhando para os próximos meses</h2>
          <p>Previsão de cobranças, na data em que acontecem.</p>
        </div>
        <span className="small-tag">Projeção</span>
      </div>
      <div
        className="projection-chart"
        role="img"
        aria-label={stats.projection
          .map(
            (p) =>
              `${dateLabel(p.month)}: ${money(p.amount, workspace.preferences.baseCurrency)}${p.missing ? ", há cobranças sem conversão" : ""}`,
          )
          .join("; ")}
      >
        {stats.projection.map((p, i) => (
          <div className="projection-column" key={p.month}>
            <span>
              {p.missing && p.amount.isZero()
                ? "—"
                : money(p.amount, workspace.preferences.baseCurrency, 0)}
            </span>
            <div className="projection-bar-space">
              <div
                className={
                  i === 0 ? "projection-bar current" : "projection-bar"
                }
                style={{
                  height: `${p.amount.div(max).mul(100).toNumber()}%`,
                  minHeight: p.amount.gt(0) ? 4 : 0,
                }}
              />
            </div>
            <strong>
              {new Intl.DateTimeFormat("pt-BR", {
                month: "short",
                timeZone: "UTC",
              })
                .format(parseDay(p.month))
                .replace(".", "")}
            </strong>
          </div>
        ))}
      </div>
      <p className="panel-caption">
        Previsão com os planos e a cotação atuais. Não representa pagamentos
        realizados.
        {!workspace.preferences.usdBrl
          ? " Serviços em USD ficam fora do total em BRL, e vice-versa."
          : ""}
      </p>
    </section>
  );
}

export function AgendaView({
  workspace,
  onOpen,
}: {
  workspace: Workspace;
  onOpen: (s: Subscription) => void;
}) {
  const stats = overview(workspace);
  const groups = Map.groupBy(stats.upcoming, (e) => e.date);
  return (
    <section className="panel agenda-view">
      <div className="panel-heading">
        <h2>Sua próxima renovação, sem surpresas</h2>
        <span className="small-tag">Datas estimadas</span>
      </div>
      {groups.size ? (
        [...groups].map(([date, entries]) => (
          <div key={date} className="agenda-group">
            <div>
              <strong>{parseDay(date).getUTCDate()}</strong>
              <span>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "short",
                  timeZone: "UTC",
                }).format(parseDay(date))}
              </span>
            </div>
            <section>
              {entries.map(({ subscription: s }) => (
                <button
                  className="agenda-item"
                  onClick={() => onOpen(s)}
                  key={s.id}
                >
                  <ServiceLogo service={s.service} name={s.name} />
                  <span>
                    <strong>{s.name}</strong>
                    <span>{s.category}</span>
                  </span>
                  <b>{money(s.amount, s.currency)}</b>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </section>
          </div>
        ))
      ) : (
        <p className="small-empty">
          Adicione uma assinatura com a próxima data de cobrança para montar sua
          agenda.
        </p>
      )}
    </section>
  );
}
