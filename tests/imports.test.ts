import { describe, it, expect } from "vitest";
import {
  parseAmount,
  parseCsvDate,
  previewCsv,
  readCsv,
  suggestMapping,
  subscriptionsCsv,
} from "@/domain/imports";
import { emptyWorkspace } from "@/domain/model";
import { demoWorkspace } from "@/domain/demo";
const id = "00000000-0000-4000-8000-000000000001";
describe("CSV e conciliação", () => {
  it("interpreta decimal BRL, USD e créditos", () => {
    expect(parseAmount("R$ 1.234,56").toString()).toBe("1234.56");
    expect(parseAmount("1,234.56").toString()).toBe("1234.56");
    expect(parseAmount("(29,90)").toString()).toBe("-29.9");
    expect(() => parseAmount("1,2,3")).toThrow();
  });
  it("exige data completa e respeita formato escolhido", () => {
    expect(parseCsvDate("04/05/2026", "dmy")).toBe("2026-05-04");
    expect(parseCsvDate("04/05/2026", "mdy")).toBe("2026-04-05");
    expect(() => parseCsvDate("31/02/2026", "dmy")).toThrow();
    expect(() => parseCsvDate("01/02/26", "dmy")).toThrow();
  });
  it("repete arquivo sem duplicar e preserva multiplicidade legítima", () => {
    const file = readCsv(
      "\uFEFFData;Descrição;Valor\n01/10/2026;GitHub;-10,00\n01/10/2026;GitHub;-10,00",
    );
    const mapping = suggestMapping(file.fields),
      w = emptyWorkspace();
    const first = previewCsv(file, mapping, w, id);
    expect(first.rows).toHaveLength(2);
    expect(first.errors).toHaveLength(0);
    w.transactions = first.rows;
    const repeated = previewCsv(file, mapping, w, id);
    expect(repeated.rows).toHaveLength(0);
    expect(repeated.duplicates).toBe(2);
  });
  it("separa faturas, parcelas e estornos", () => {
    const f = readCsv(
      "date,description,amount\n2026-10-01,Pagamento de fatura,-100\n2026-10-02,Compra 03/12,-50\n2026-10-03,Estorno,20",
    );
    const p = previewCsv(f, suggestMapping(f.fields), emptyWorkspace(), id);
    expect(p.rows.map((t) => t.kind)).toEqual([
      "invoice_payment",
      "installment",
      "refund",
    ]);
  });
  it("rejeita moeda desconhecida e reporta linha", () => {
    const f = readCsv(
      "date,description,amount,currency\n2026-10-01,Teste,-20,XYZ",
    );
    const p = previewCsv(f, suggestMapping(f.fields), emptyWorkspace(), id);
    expect(p.rows).toHaveLength(0);
    expect(p.errors[0]).toContain("Linha 2");
  });
  it("neutraliza fórmula na exportação de texto", () => {
    const w = demoWorkspace();
    w.subscriptions[0].name = '=IMPORTXML("https://example.test")';
    expect(subscriptionsCsv(w)).toContain("'=IMPORTXML");
  });
});
