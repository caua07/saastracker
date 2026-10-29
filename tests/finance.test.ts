import { describe, it, expect } from "vitest";
import {
  addMonths,
  billingDates,
  nextBilling,
  monthly,
  effectiveStatus,
  overview,
  recordedSpend,
  historicalMonthly,
} from "@/domain/finance";
import {
  emptyWorkspace,
  type Subscription,
  type Transaction,
} from "@/domain/model";

function sub(extra: Partial<Subscription> = {}): Subscription {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Serviço",
    service: "",
    amount: "120",
    currency: "USD",
    cycle: "yearly",
    category: "Outros",
    status: "active",
    anchorDate: "2026-01-31",
    startDate: "2026-01-01",
    cancelDate: null,
    website: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    history: [
      {
        effectiveFrom: "2026-01-01",
        amount: "120",
        currency: "USD",
        cycle: "yearly",
      },
    ],
    ...extra,
  };
}
describe("calendário financeiro", () => {
  it("preserva a âncora 31 após fevereiro", () => {
    const s = sub({ cycle: "monthly" });
    expect(billingDates(s, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });
  it("trata ano bissexto e trimestre por calendário", () => {
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addMonths("2026-01-31", 3)).toBe("2026-04-30");
  });
  it("não projeta depois do término ou em pausa", () => {
    expect(
      effectiveStatus(sub({ cancelDate: "2026-03-01" }), "2026-03-01"),
    ).toBe("canceled");
    expect(
      nextBilling(
        sub({ cycle: "monthly", cancelDate: "2026-03-01" }),
        "2026-03-01",
      ),
    ).toBeNull();
    expect(nextBilling(sub({ status: "paused" }), "2026-01-01")).toBeNull();
  });
  it("uma assinatura semanal pode ter 53 eventos no ano", () => {
    expect(
      billingDates(
        sub({ cycle: "weekly", anchorDate: "2026-01-01" }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toHaveLength(53);
  });
});
describe("valores e ausência de evidência", () => {
  it("divide anual sem inventar pagamentos", () => {
    const w = emptyWorkspace();
    w.subscriptions = [sub()];
    expect(monthly("120", "yearly").toString()).toBe("10");
    expect(w.transactions).toHaveLength(0);
    expect(recordedSpend(w, "2026-01").total.toString()).toBe("0");
  });
  it("soma decimal exatamente", () => {
    expect(
      monthly("0.1", "monthly").add(monthly("0.2", "monthly")).toString(),
    ).toBe("0.3");
  });
  it("preserva USD sem cotação, fora da consolidação BRL", () => {
    const w = emptyWorkspace();
    w.subscriptions = [sub()];
    const stats = overview(w, "2026-01-01");
    expect(stats.total.toString()).toBe("0");
    expect(stats.unconverted.USD.toString()).toBe("10");
  });
  it("converte com taxa explícita, não reaplica em mesma moeda", () => {
    const w = emptyWorkspace();
    w.preferences.usdBrl = "5.20";
    w.preferences.fxDate = "2026-01-01";
    w.subscriptions = [
      sub(),
      sub({
        id: "00000000-0000-4000-8000-000000000002",
        currency: "BRL",
        amount: "120",
      }),
    ];
    expect(overview(w, "2026-01-01").total.toString()).toBe("62");
  });
  it("exclui pagamento de fatura e pendentes e desconta estorno", () => {
    const w = emptyWorkspace();
    const base: Transaction = {
      id: "00000000-0000-4000-8000-000000000001",
      date: "2026-01-15",
      description: "Serviço",
      amount: "100",
      currency: "BRL",
      direction: "debit",
      kind: "expense",
      account: "Cartão",
      sourceKey: "a",
      importId: "00000000-0000-4000-8000-000000000003",
      subscriptionId: sub().id,
      pending: false,
    };
    w.transactions = [
      base,
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000002",
        kind: "invoice_payment",
      },
      { ...base, id: "00000000-0000-4000-8000-000000000003", pending: true },
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000004",
        kind: "refund",
        direction: "credit",
        amount: "25",
      },
    ];
    expect(recordedSpend(w, "2026-01").total.toString()).toBe("75");
  });
  it("histórico desconhecido é null e alteração atual não reescreve termo anterior", () => {
    const s = sub({
      amount: "240",
      history: [
        ...sub().history,
        {
          effectiveFrom: "2026-06-01",
          amount: "240",
          currency: "USD",
          cycle: "yearly",
        },
      ],
    });
    const prefs = {
      ...emptyWorkspace().preferences,
      baseCurrency: "USD" as const,
    };
    expect(historicalMonthly([s], "2025-12-31", prefs)).toBeNull();
    expect(historicalMonthly([s], "2026-03-01", prefs)?.toString()).toBe("10");
    expect(historicalMonthly([s], "2026-07-01", prefs)?.toString()).toBe("20");
  });
});
