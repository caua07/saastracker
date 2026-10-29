import {
  emptyWorkspace,
  type Workspace,
  type Subscription,
  type Cycle,
} from "./model";
import { today, addDays, addMonths } from "./finance";
import { serviceById } from "./catalog";

/** Synthetic fixtures, never seeded into the owner's database. */
export function demoWorkspace(): Workspace {
  const day = today(),
    now = new Date().toISOString();
  const w = emptyWorkspace();
  w.preferences = {
    ...w.preferences,
    displayName: "Você",
    usdBrl: "5.20",
    fxDate: day,
  };
  const entries: [string, string, string, "BRL" | "USD", Cycle, number][] = [
    ["figma", "Figma Professional", "15.00", "USD", "monthly", 2],
    ["openai", "ChatGPT Plus", "20.00", "USD", "monthly", 4],
    ["github", "GitHub Copilot", "10.00", "USD", "monthly", 7],
    ["notion", "Notion Plus", "96.00", "USD", "yearly", 11],
    ["spotify", "Spotify Premium", "23.90", "BRL", "monthly", 5],
    ["vercel", "Vercel Pro", "20.00", "USD", "monthly", 14],
    ["cursor", "Cursor Pro", "20.00", "USD", "monthly", 18],
    ["linear", "Linear Basic", "10.00", "USD", "monthly", 22],
  ];
  w.subscriptions = entries.map(
    ([service, name, amount, currency, cycle, offset], i) => {
      const startDate = addMonths(day, -4);
      return {
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        service,
        name,
        amount,
        currency,
        cycle,
        category: serviceById(service)!.category as Subscription["category"],
        status: "active",
        anchorDate: addDays(day, offset),
        startDate,
        cancelDate: null,
        website: `https://${serviceById(service)!.domain}`,
        notes:
          "Dados de demonstração. Valores ilustrativos, não representam uma cotação atual do serviço.",
        history: [{ effectiveFrom: startDate, amount, currency, cycle }],
        createdAt: now,
        updatedAt: now,
      };
    },
  );
  return w;
}
