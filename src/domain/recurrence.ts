import Decimal from "decimal.js";
import type { Cycle, Transaction, Workspace } from "./model";
import { services } from "./catalog";
import { dayDiff, occurrence } from "./finance";
import { normalizeDescription } from "./imports";

export type Candidate = {
  key: string;
  name: string;
  service: string;
  category: string;
  currency: "BRL" | "USD";
  cycle: Cycle;
  amount: string;
  score: number;
  confidence: "high" | "medium" | "low";
  evidence: Transaction[];
  evidenceHash: string;
  reasons: string[];
  variable: boolean;
};
export function merchantFor(description: string) {
  const normalized = normalizeDescription(description);
  const aliases: Record<string, RegExp> = {
    openai: /\b(openai|chatgpt)\b/,
    anthropic: /\b(anthropic|claude)\b/,
    google: /google\s*(one|storage)/,
  };
  const service = services.find((s) =>
    (aliases[s.id] ?? new RegExp(`\\b${s.id}\\b`)).test(normalized),
  );
  return service
    ? {
        key: service.id,
        name: service.name,
        service: service.id,
        category: service.category,
        known: true,
      }
    : {
        key: normalized
          .replace(/^(compra|cartao|cartão|purchase|debit)\s+/g, "")
          .replace(/\*\d{3,}$/, ""),
        name: description.trim(),
        service: "",
        category: "Outros",
        known: false,
      };
}
export function detectRecurrences(workspace: Workspace): Candidate[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of workspace.transactions) {
    if (
      t.kind !== "expense" ||
      t.direction !== "debit" ||
      t.pending ||
      t.subscriptionId
    )
      continue;
    const merchant = merchantFor(t.description);
    const key = [t.account, merchant.key, t.currency].join("|");
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const result: Candidate[] = [];
  for (const [key, unsorted] of groups) {
    const rows = unsorted.sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length < 2) continue;
    const merchant = merchantFor(rows[0].description);
    const models: {
      cycle: Cycle;
      tolerance: number;
      fit: number;
      unique: Transaction[];
    }[] = [];
    for (const [cycle, tolerance] of [
      ["weekly", 2],
      ["monthly", 4],
      ["quarterly", 7],
      ["yearly", 14],
    ] as const) {
      const periods = new Map<number, Transaction>();
      for (const row of rows) {
        let best = Infinity,
          bestN = 0;
        for (let n = 0; n < Math.min(600, rows.length * 60); n++) {
          const expected = occurrence(rows[0].date, cycle, n);
          const delta = Math.abs(dayDiff(row.date, expected));
          if (delta < best) {
            best = delta;
            bestN = n;
          }
          if (expected > row.date && delta > tolerance) break;
        }
        if (best <= tolerance && !periods.has(bestN)) periods.set(bestN, row);
      }
      const max = Math.max(...periods.keys());
      const fit = periods.size / Math.max(rows.length, max + 1);
      models.push({ cycle, tolerance, fit, unique: [...periods.values()] });
    }
    models.sort((a, b) => b.fit - a.fit);
    const model = models[0];
    if (model.unique.length < 2 || model.fit < 0.6) continue;
    const values = model.unique
      .map((t) => new Decimal(t.amount))
      .sort((a, b) => a.cmp(b));
    const median = values[Math.floor(values.length / 2)];
    const variation = values.reduce(
      (max, value) => Decimal.max(max, value.sub(median).abs().div(median)),
      new Decimal(0),
    );
    const variable = variation.gt(0.2);
    const identity = merchant.known ? 25 : 20;
    const cadence = model.unique.length >= 3 && model.fit >= 0.8 ? 30 : 20;
    const support =
      model.unique.length >= 4 ? 15 : model.unique.length === 3 ? 10 : 5;
    const valueScore = variation.lte(0.05) ? 15 : variation.lte(0.2) ? 8 : 0;
    const ambiguous = models[1].fit >= model.fit - 0.05;
    let score =
      identity +
      cadence +
      support +
      valueScore +
      (merchant.known ? 8 : 0) -
      (ambiguous ? 15 : 0);
    score = Math.max(0, Math.min(100, score));
    const enough = model.cycle === "yearly" ? false : model.unique.length >= 3;
    const confidence =
      score >= 80 && enough && !ambiguous
        ? "high"
        : score >= 60
          ? "medium"
          : "low";
    const evidenceHash = model.unique
      .map((t) => `${t.id}:${t.date}:${t.amount}`)
      .join(";");
    if (
      workspace.decisions.some(
        (d) => d.key === key && d.evidenceHash === evidenceHash,
      )
    )
      continue;
    const reasons = [
      `${model.unique.length} cobranças em períodos distintos`,
      `${Math.round(model.fit * 100)}% de aderência ao calendário`,
      variable
        ? "Valor variável; confirme o modelo de cobrança"
        : variation.isZero()
          ? "Mesmo valor em todas as cobranças"
          : "Valores próximos na moeda original",
      merchant.known
        ? "Serviço reconhecido pelo catálogo"
        : "Descrição semelhante; estabelecimento precisa de revisão",
    ];
    if (ambiguous)
      reasons.push("Mais de um ciclo plausível; confirme a frequência.");
    if (model.cycle === "yearly")
      reasons.push("Recorrência anual exige confirmação documental ou manual.");
    result.push({
      key,
      name: merchant.name,
      service: merchant.service,
      category: merchant.category,
      currency: rows[0].currency,
      cycle: model.cycle,
      amount: median.toFixed(),
      score,
      confidence,
      evidence: model.unique,
      evidenceHash,
      reasons,
      variable,
    });
  }
  return result.sort((a, b) => b.score - a.score);
}
