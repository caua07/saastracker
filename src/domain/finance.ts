import Decimal from "decimal.js";
import type {
  Currency,
  Cycle,
  Preferences,
  Subscription,
  Workspace,
} from "./model";

export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function parseDay(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function addDays(day: string, count: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + count);
  return isoDay(d);
}
export function addMonths(day: string, count: number): string {
  const d = parseDay(day);
  const anchor = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + count);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(last, anchor));
  return isoDay(d);
}
export function occurrence(anchor: string, cycle: Cycle, n: number): string {
  return cycle === "weekly"
    ? addDays(anchor, n * 7)
    : addMonths(anchor, n * { monthly: 1, quarterly: 3, yearly: 12 }[cycle]);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}
export function effectiveStatus(
  s: Subscription,
  day = today(),
): Subscription["status"] {
  return s.cancelDate && s.cancelDate <= day && s.status !== "archived"
    ? "canceled"
    : s.status;
}
export function activeAt(s: Subscription, day = today()): boolean {
  return effectiveStatus(s, day) === "active" && s.startDate <= day;
}
export function nextBilling(s: Subscription, from = today()): string | null {
  if (["canceled", "paused", "archived"].includes(s.status)) return null;
  const min = from > s.startDate ? from : s.startDate;
  let n = 0;
  if (min > s.anchorDate) {
    const a = parseDay(s.anchorDate),
      b = parseDay(min);
    n =
      s.cycle === "weekly"
        ? Math.max(0, Math.floor(dayDiff(min, s.anchorDate) / 7))
        : Math.max(
            0,
            Math.floor(
              ((b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
                b.getUTCMonth() -
                a.getUTCMonth()) /
                { monthly: 1, quarterly: 3, yearly: 12 }[s.cycle],
            ),
          );
  }
  let next = occurrence(s.anchorDate, s.cycle, n);
  while (next < min) next = occurrence(s.anchorDate, s.cycle, ++n);
  if (s.cancelDate && next >= s.cancelDate) return null;
  return next;
}
export function billingDates(
  s: Subscription,
  from: string,
  to: string,
): string[] {
  const dates: string[] = [];
  let next = nextBilling(s, from);
  while (next && next <= to && dates.length < 400) {
    dates.push(next);
    next = nextBilling(s, addDays(next, 1));
  }
  return dates;
}
export function monthly(amount: string, cycle: Cycle): Decimal {
  const p = new Decimal(amount);
  return cycle === "yearly"
    ? p.div(12)
    : cycle === "quarterly"
      ? p.div(3)
      : cycle === "weekly"
        ? p.mul(52).div(12)
        : p;
}
export function convert(
  amount: Decimal.Value,
  currency: Currency,
  prefs: Preferences,
): Decimal | null {
  const value = new Decimal(amount);
  if (currency === prefs.baseCurrency) return value;
  if (!prefs.usdBrl) return null;
  const rate = new Decimal(prefs.usdBrl);
  return currency === "USD" ? value.mul(rate) : value.div(rate);
}
export function money(
  value: Decimal.Value,
  currency: Currency = "BRL",
  digits = 2,
): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(new Decimal(value).toNumber());
}
export function dateLabel(day: string, short = false): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: short ? "short" : "long",
    timeZone: "UTC",
  }).format(parseDay(day));
}
export const cycleLabels: Record<Cycle, string> = {
  monthly: "Mensal",
  yearly: "Anual",
  weekly: "Semanal",
  quarterly: "Trimestral",
};
export const cycleSuffix: Record<Cycle, string> = {
  monthly: "mês",
  yearly: "ano",
  weekly: "semana",
  quarterly: "trimestre",
};

export function overview(workspace: Workspace, day = today()) {
  const active = workspace.subscriptions.filter((s) => activeAt(s, day));
  let total = new Decimal(0);
  const unconverted: Record<Currency, Decimal> = {
    BRL: new Decimal(0),
    USD: new Decimal(0),
  };
  for (const s of active) {
    const value = monthly(s.amount, s.cycle);
    const converted = convert(value, s.currency, workspace.preferences);
    if (converted === null)
      unconverted[s.currency] = unconverted[s.currency].add(value);
    else total = total.add(converted);
  }
  const upcoming = workspace.subscriptions
    .map((s) => ({ subscription: s, date: nextBilling(s, day) }))
    .filter((e): e is { subscription: Subscription; date: string } => !!e.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const categories = Array.from(new Set(active.map((s) => s.category)))
    .map((category) => ({
      name: category,
      total: active
        .filter((s) => s.category === category)
        .reduce(
          (acc, s) =>
            acc.add(
              convert(
                monthly(s.amount, s.cycle),
                s.currency,
                workspace.preferences,
              ) ?? 0,
            ),
          new Decimal(0),
        ),
      count: active.filter((s) => s.category === category).length,
      missing: active.filter(
        (s) =>
          s.category === category &&
          convert(s.amount, s.currency, workspace.preferences) === null,
      ).length,
    }))
    .sort((a, b) => b.total.cmp(a.total));
  const projection = Array.from({ length: 6 }, (_, i) => {
    const from = addMonths(day.slice(0, 8) + "01", i);
    const to = addDays(addMonths(from, 1), -1);
    const amount = workspace.subscriptions.reduce(
      (sum, s) =>
        sum.add(
          (
            convert(s.amount, s.currency, workspace.preferences) ??
            new Decimal(0)
          ).mul(billingDates(s, from, to).length),
        ),
      new Decimal(0),
    );
    const missing = workspace.subscriptions.filter(
      (s) =>
        convert(s.amount, s.currency, workspace.preferences) === null &&
        billingDates(s, from, to).length > 0,
    ).length;
    return { month: from, amount, missing };
  });
  return {
    active,
    total,
    annual: total.mul(12),
    unconverted,
    upcoming,
    categories,
    projection,
  };
}

export function historicalMonthly(
  subscriptions: Subscription[],
  day: string,
  prefs: Preferences,
): Decimal | null {
  let sum = new Decimal(0),
    known = false;
  for (const s of subscriptions) {
    if (
      s.status === "archived" ||
      s.startDate > day ||
      (s.cancelDate && s.cancelDate <= day)
    )
      continue;
    const term = s.history
      .filter((t) => t.effectiveFrom <= day)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    if (!term) continue;
    const v = convert(monthly(term.amount, term.cycle), term.currency, prefs);
    if (v !== null) {
      known = true;
      sum = sum.add(v);
    }
  }
  return known ? sum : null;
}

export function recordedSpend(
  workspace: Workspace,
  month: string,
): { total: Decimal; missing: number } {
  let total = new Decimal(0),
    missing = 0;
  for (const t of workspace.transactions) {
    if (
      !t.date.startsWith(month) ||
      t.pending ||
      !t.subscriptionId ||
      ["transfer", "invoice_payment"].includes(t.kind)
    )
      continue;
    const v = convert(t.amount, t.currency, workspace.preferences);
    if (v === null) {
      missing++;
      continue;
    }
    total = total.add(t.direction === "credit" ? v.neg() : v);
  }
  return { total, missing };
}
