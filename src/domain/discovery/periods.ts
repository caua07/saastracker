import type { Transaction } from "../model";

export type StatementPeriod = { month: string; count: number };
export type AccountHistory = {
  account: string;
  months: StatementPeriod[];
  missingMonths: number;
};
const monthIndex = (month: string) =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));

/** Observed transaction months, never a claim that a statement covers a full month. */
export function statementHistory(
  transactions: Transaction[],
): AccountHistory[] {
  const accounts = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    const months = accounts.get(t.account) ?? new Map<string, number>();
    const month = t.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    accounts.set(t.account, months);
  }
  return [...accounts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([account, counts]) => {
      const months = [...counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));
      return {
        account,
        months,
        missingMonths:
          monthIndex(months.at(-1)!.month) -
          monthIndex(months[0].month) +
          1 -
          months.length,
      };
    });
}

export function compareStatementPeriods(
  existing: Transaction[],
  incoming: Transaction[],
  account: string,
) {
  const prior = statementHistory(existing).find((h) => h.account === account);
  const before = new Set(prior?.months.map((m) => m.month));
  const received = statementHistory(incoming).find(
    (h) => h.account === account,
  );
  return {
    priorMonths: before.size,
    incomingMonths: received?.months ?? [],
    newMonths: received?.months.filter((m) => !before.has(m.month)) ?? [],
    totalMonths: new Set([
      ...before,
      ...(received?.months.map((m) => m.month) ?? []),
    ]).size,
  };
}

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
