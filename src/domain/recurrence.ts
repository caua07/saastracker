import Decimal from "decimal.js";
import type { Cycle, Transaction, Workspace } from "./model";
import { dayDiff } from "./finance";
import { merchantFor } from "./discovery/merchants";
import { findCadence } from "./discovery/cadence";
import { statementHistory, type AccountHistory } from "./discovery/periods";
import { scheduleLabel, type ObservedSchedule } from "./discovery/schedule";
export { merchantFor } from "./discovery/merchants";

export type Candidate = {
  key: string;
  name: string;
  service: string;
  category: string;
  currency: "BRL" | "USD";
  cycle: Cycle | null;
  basis: "recurrence" | "recognized_service";
  amount: string;
  score: number;
  confidence: "high" | "medium" | "low";
  evidence: Transaction[];
  evidenceHash: string;
  reasons: string[];
  variable: boolean;
  schedule: ObservedSchedule | null;
};
export type DiscoveryReport = {
  candidates: Candidate[];
  recurring: Candidate[];
  possible: Candidate[];
  history: AccountHistory[];
  coverage: {
    count: number;
    eligible: number;
    from: string | null;
    to: string | null;
    days: number;
    invoicePayments: number;
    excluded: number;
    unknown: number;
  };
};
function evidenceHash(rows: Transaction[]) {
  const legacy = rows.map((t) => `${t.id}:${t.date}:${t.amount}`).join(";");
  if (legacy.length <= 5000) return legacy;
  // Review fingerprint only, not a security token. Bound the persisted decision size.
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < legacy.length; i++) {
    a = Math.imul(a ^ legacy.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ legacy.charCodeAt(i);
  }
  return `v2:${rows.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
export function analyzeDiscovery(workspace: Workspace): DiscoveryReport {
  const groups = new Map<string, Transaction[]>();
  let eligible = 0,
    unknown = 0;
  const dates = workspace.transactions.map((t) => t.date).sort();
  for (const t of workspace.transactions) {
    if (
      t.kind !== "expense" ||
      t.direction !== "debit" ||
      t.pending ||
      t.subscriptionId ||
      new Decimal(t.amount).lte(0)
    )
      continue;
    eligible++;
    const merchant = merchantFor(t.description);
    if (!merchant.identifiable) {
      unknown++;
      continue;
    }
    const key = [t.account, merchant.key, t.currency].join("|");
    const rows = groups.get(key) ?? [];
    rows.push(t);
    groups.set(key, rows);
  }
  const candidates: Candidate[] = [];
  for (const [key, unsorted] of groups) {
    const rows = [...unsorted].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
    const merchant = merchantFor(rows[0].description),
      model = findCadence(rows, merchant.known);
    if (!model && !merchant.known) continue;
    const basis = model ? "recurrence" : "recognized_service";
    const evidence = model?.evidence ?? rows;
    const schedule: ObservedSchedule | null = model
      ? {
          anchorDate: model.anchorDate,
          lastDate: evidence.at(-1)!.date,
          nextDate: model.nextDate,
          tolerance: model.tolerance,
          maxDeviation: model.maxDeviation,
          months: [...new Set(evidence.map((t) => t.date.slice(0, 7)))],
        }
      : null;
    const hash = evidenceHash(evidence);
    if (
      workspace.decisions.some((d) => d.key === key && d.evidenceHash === hash)
    )
      continue;
    const variable = model
      ? model.variation.gt(0.2)
      : new Set(rows.map((t) => new Decimal(t.amount).toFixed())).size > 1;
    const score = model
      ? Math.max(
          0,
          Math.min(
            100,
            (merchant.known ? 35 : 20) +
              Math.round(model.fit * 25) +
              (evidence.length >= 3 ? 15 : 5) +
              (model.variation.lte(0.05)
                ? 15
                : model.variation.lte(0.2)
                  ? 8
                  : 0) -
              (model.ambiguous ? 15 : 0),
          ),
        )
      : 30;
    const confidence =
      model &&
      score >= 80 &&
      model.fit >= 0.85 &&
      evidence.length >= 3 &&
      !model.ambiguous &&
      model.cycle !== "yearly"
        ? "high"
        : model && score >= 60
          ? "medium"
          : "low";
    const reasons = model
      ? [
          `${evidence.length} cobranças em períodos distintos`,
          scheduleLabel(schedule!, model.cycle),
          `${Math.round(model.fit * 100)}% dos períodos esperados têm uma cobrança`,
          variable
            ? "Valor variável; confira se há cobrança por uso"
            : model.variation.isZero()
              ? "Mesmo valor nas cobranças usadas"
              : "Valores próximos na moeda original",
          merchant.known
            ? "Serviço reconhecido pelo catálogo"
            : "Estabelecimento desconhecido: o padrão não comprova uma assinatura",
          ...(model.ambiguous
            ? ["Mais de um ciclo plausível; confirme a frequência."]
            : []),
          ...(model.cycle === "yearly"
            ? ["Recorrência anual exige confirmação documental ou manual."]
            : []),
        ]
      : [
          "Serviço reconhecido pela descrição do movimento",
          `${evidence.length} ${evidence.length === 1 ? "cobrança encontrada; pode ser uma compra avulsa" : "cobranças encontradas, sem calendário consistente"}`,
          "Frequência não identificada; confirme o plano e a próxima cobrança",
        ];
    candidates.push({
      key,
      name: merchant.name,
      service: merchant.service,
      category: merchant.category,
      currency: rows[0].currency,
      cycle: model?.cycle ?? null,
      basis,
      amount: model?.amount ?? rows.at(-1)!.amount,
      score,
      confidence,
      evidence,
      evidenceHash: hash,
      reasons,
      variable,
      schedule,
    });
  }
  candidates.sort(
    (a, b) =>
      Number(b.basis === "recurrence") - Number(a.basis === "recurrence") ||
      b.score - a.score ||
      a.name.localeCompare(b.name),
  );
  return {
    candidates,
    recurring: candidates.filter((c) => c.basis === "recurrence"),
    possible: candidates.filter((c) => c.basis === "recognized_service"),
    history: statementHistory(workspace.transactions),
    coverage: {
      count: dates.length,
      eligible,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
      days: dates.length ? dayDiff(dates.at(-1)!, dates[0]) + 1 : 0,
      invoicePayments: workspace.transactions.filter(
        (t) => t.kind === "invoice_payment",
      ).length,
      excluded: dates.length - eligible,
      unknown,
    },
  };
}
/** Backwards-compatible strict-pattern API; UI uses the full discovery report. */
export function detectRecurrences(workspace: Workspace): Candidate[] {
  return analyzeDiscovery(workspace).recurring;
}
