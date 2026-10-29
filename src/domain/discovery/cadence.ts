import Decimal from "decimal.js";
import type { Cycle, Transaction } from "../model";
import { dayDiff, occurrence } from "../finance";

export type Cadence = {
  cycle: Cycle;
  fit: number;
  evidence: Transaction[];
  variation: Decimal;
  amount: string;
  ambiguous: boolean;
};
const specifications = [
  { cycle: "weekly", tolerance: 1, minimum: 4 },
  { cycle: "monthly", tolerance: 4, minimum: 2 },
  { cycle: "quarterly", tolerance: 7, minimum: 2 },
  { cycle: "yearly", tolerance: 14, minimum: 2 },
] as const;
const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/** Actual occupied periods / elapsed periods. Missing weeks cannot become weekly evidence. */
export function findCadence(
  rows: Transaction[],
  known: boolean,
): Cadence | null {
  const uniqueDays = [...new Map(rows.map((t) => [t.date, t])).values()];
  if (uniqueDays.length < 2) return null;
  const models: Omit<Cadence, "ambiguous">[] = [];
  for (const spec of specifications) {
    const minimum = known ? spec.minimum : Math.max(spec.minimum, 3);
    if (uniqueDays.length < minimum) continue;
    let best: { fit: number; evidence: Transaction[] } | null = null;
    for (const anchor of uniqueDays.slice(0, 6)) {
      const periods = new Map<number, Transaction>();
      for (const row of uniqueDays) {
        if (row.date < anchor.date) continue;
        const approximate =
          spec.cycle === "weekly"
            ? Math.round(dayDiff(row.date, anchor.date) / 7)
            : Math.round(
                (monthIndex(row.date) - monthIndex(anchor.date)) /
                  { monthly: 1, quarterly: 3, yearly: 12 }[spec.cycle],
              );
        let distance = Infinity,
          slot = 0;
        for (const n of [
          Math.max(0, approximate - 1),
          Math.max(0, approximate),
          approximate + 1,
        ]) {
          const d = Math.abs(
            dayDiff(row.date, occurrence(anchor.date, spec.cycle, n)),
          );
          if (d < distance) {
            distance = d;
            slot = n;
          }
        }
        if (distance <= spec.tolerance && !periods.has(slot))
          periods.set(slot, row);
      }
      const occupied = [...periods.keys()];
      const span = occupied.length ? Math.max(...occupied) + 1 : 0;
      // Multiple purchases in one period reduce support instead of inventing monthly plans.
      const fit = periods.size / Math.max(span, rows.length);
      if (!best || fit > best.fit)
        best = { fit, evidence: [...periods.values()] };
    }
    if (
      !best ||
      best.evidence.length < minimum ||
      best.fit < (spec.cycle === "weekly" ? 0.85 : 0.75)
    )
      continue;
    const values = best.evidence
      .map((t) => new Decimal(t.amount))
      .sort((a, b) => a.cmp(b));
    const median = values[Math.floor(values.length / 2)];
    if (median.lte(0)) continue;
    const variation = values.reduce(
      (max, v) => Decimal.max(max, v.sub(median).abs().div(median)),
      new Decimal(0),
    );
    // A generic merchant with irregular prices is weak evidence; recognized usage-based services stay reviewable.
    if (!known && variation.gt(0.1)) continue;
    models.push({
      cycle: spec.cycle,
      fit: best.fit,
      evidence: best.evidence,
      variation,
      amount: median.toFixed(),
    });
  }
  models.sort((a, b) => b.fit - a.fit);
  if (!models.length) return null;
  return {
    ...models[0],
    ambiguous: !!models[1] && models[1].fit >= models[0].fit - 0.05,
  };
}
