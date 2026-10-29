import type { Cycle } from "../model";
import { dayDiff, occurrence } from "../finance";

export type ObservedSchedule = {
  anchorDate: string;
  lastDate: string;
  nextDate: string;
  tolerance: number;
  maxDeviation: number;
  months: string[];
};

/** Calendar arithmetic from the original anchor preserves Jan 31 → Feb 28 → Mar 31. */
export function nextScheduledDate(
  anchor: string,
  cycle: Cycle,
  from: string,
): string {
  const interval = { monthly: 1, quarterly: 3, yearly: 12 };
  let n =
    cycle === "weekly"
      ? Math.max(0, Math.floor(dayDiff(from, anchor) / 7))
      : Math.max(
          0,
          Math.floor(
            ((Number(from.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 +
              Number(from.slice(5, 7)) -
              Number(anchor.slice(5, 7))) /
              interval[cycle],
          ),
        );
  while (occurrence(anchor, cycle, n) < from) n++;
  return occurrence(anchor, cycle, n);
}

/** Skip the last occupied cycle even when a payment posted before its nominal day. */
export function nextUnobservedDate(
  schedule: ObservedSchedule,
  cycle: Cycle,
  from: string,
): string {
  return nextScheduledDate(
    schedule.anchorDate,
    cycle,
    from > schedule.nextDate ? from : schedule.nextDate,
  );
}

export function scheduleLabel(
  schedule: ObservedSchedule,
  cycle: Cycle,
): string {
  const day = Number(schedule.anchorDate.slice(8, 10));
  if (cycle === "monthly")
    return `Por volta do dia ${day} de cada mês${day > 28 ? " (ajustado em meses curtos)" : ""}`;
  if (cycle === "quarterly")
    return `Por volta do dia ${day}, a cada três meses`;
  if (cycle === "yearly")
    return `Por volta de ${schedule.anchorDate.slice(5).split("-").reverse().join("/")}, a cada ano`;
  return "Aproximadamente a cada sete dias";
}
