import { describe, it, expect } from "vitest";
import { detectRecurrences } from "@/domain/recurrence";
import { emptyWorkspace, type Transaction } from "@/domain/model";
function fixture() {
  const w = emptyWorkspace();
  w.transactions = ["2026-08-10", "2026-09-11", "2026-10-10"].map(
    (date, i) =>
      ({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        date,
        description: "GITHUB INC",
        amount: "10",
        currency: "USD",
        direction: "debit",
        kind: "expense",
        account: "Cartão",
        sourceKey: `github-${i}`,
        importId: "00000000-0000-4000-8000-000000000010",
        subscriptionId: null,
        pending: false,
      }) satisfies Transaction,
  );
  return w;
}
describe("recorrências interpretáveis", () => {
  it("detecta três mensalidades e expõe evidências", () => {
    const result = detectRecurrences(fixture());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cycle: "monthly",
      confidence: "high",
      currency: "USD",
    });
    expect(result[0].evidence).toHaveLength(3);
    expect(result[0].reasons.join(" ")).toContain("3 cobranças");
  });
  it("não considera uma compra isolada recorrente", () => {
    const w = fixture();
    w.transactions = w.transactions.slice(0, 1);
    expect(detectRecurrences(w)).toHaveLength(0);
  });
  it("exclui parcelas, faturas, pendentes e já vinculadas", () => {
    for (const patch of [
      { kind: "installment" },
      { kind: "invoice_payment" },
      { pending: true },
      { subscriptionId: "00000000-0000-4000-8000-000000000090" },
    ]) {
      const w = fixture();
      w.transactions = w.transactions.map(
        (t) => ({ ...t, ...patch }) as Transaction,
      );
      expect(detectRecurrences(w)).toHaveLength(0);
    }
  });
  it("rejeição não ressurge com as mesmas evidências", () => {
    const w = fixture(),
      c = detectRecurrences(w)[0];
    w.decisions = [
      {
        key: c.key,
        evidenceHash: c.evidenceHash,
        status: "rejected",
        subscriptionId: null,
        updatedAt: new Date().toISOString(),
      },
    ];
    expect(detectRecurrences(w)).toHaveLength(0);
  });
  it("não mistura contas e moedas", () => {
    const w = fixture();
    w.transactions[1].currency = "BRL";
    w.transactions[2].account = "Outro cartão";
    expect(detectRecurrences(w)).toHaveLength(0);
  });
  it("dois eventos anuais não ganham alta confiança sem prova documental", () => {
    const w = fixture();
    w.transactions = w.transactions.slice(0, 2);
    w.transactions[0].date = "2025-08-10";
    w.transactions[1].date = "2026-08-10";
    const result = detectRecurrences(w);
    expect(result[0].cycle).toBe("yearly");
    expect(result[0].confidence).not.toBe("high");
  });
});
