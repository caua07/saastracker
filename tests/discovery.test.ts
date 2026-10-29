import { describe, expect, it } from "vitest";
import {
  analyzeDiscovery,
  detectRecurrences,
  merchantFor,
} from "@/domain/recurrence";
import { emptyWorkspace, type Transaction } from "@/domain/model";
import { addMonths } from "@/domain/finance";
function workspace(
  descriptions: string[],
  dates = ["2026-10-01"],
  amounts = ["29.9"],
) {
  const w = emptyWorkspace();
  w.transactions = descriptions.map(
    (description, i) =>
      ({
        id: crypto.randomUUID(),
        date: dates[i % dates.length],
        description,
        amount: amounts[i % amounts.length],
        currency: "BRL",
        direction: "debit",
        kind: "expense",
        account: "Conta de teste",
        sourceKey: `row-${i}`,
        importId: "00000000-0000-4000-8000-000000000001",
        pending: false,
        subscriptionId: null,
      }) satisfies Transaction,
  );
  return w;
}
describe("descoberta com evidência insuficiente", () => {
  it("uma cobrança de Spotify aparece como possível, sem ciclo inventado", () => {
    const w = workspace(["SPOTIFY · Compra no débito"]),
      result = analyzeDiscovery(w);
    expect(detectRecurrences(w)).toEqual([]);
    expect(result.recurring).toEqual([]);
    expect(result.possible).toHaveLength(1);
    expect(result.possible[0]).toMatchObject({
      service: "spotify",
      cycle: null,
      basis: "recognized_service",
      confidence: "low",
    });
    expect(result.possible[0].reasons.join(" ")).toContain("compra avulsa");
  });
  it("dois desconhecidos com intervalo de 13 dias não viram recorrência semanal", () => {
    const result = analyzeDiscovery(
      workspace(
        ["Loja de bairro", "Loja de bairro"],
        ["2026-10-08", "2026-10-21"],
      ),
    );
    expect(result.candidates).toEqual([]);
  });
  it("dois desconhecidos em meses diferentes não bastam para sugerir assinatura", () => {
    expect(
      analyzeDiscovery(
        workspace(
          ["Café da esquina", "Café da esquina"],
          ["2026-09-30", "2026-10-27"],
        ),
      ).candidates,
    ).toEqual([]);
  });
  it("duas cobranças reconhecidas mensais têm padrão mas não alta confiança", () => {
    const result = analyzeDiscovery(
      workspace(["Spotify", "Spotify"], ["2026-09-10", "2026-10-10"]),
    );
    expect(result.possible).toEqual([]);
    expect(result.recurring[0]).toMatchObject({
      cycle: "monthly",
      confidence: "medium",
    });
  });
  it("serviço reconhecido com compras irregulares permanece possível", () => {
    const result = analyzeDiscovery(
      workspace(
        ["GITHUB", "GITHUB", "GITHUB"],
        ["2026-10-01", "2026-10-03", "2026-10-20"],
        ["10", "40", "90"],
      ),
    );
    expect(result.recurring).toEqual([]);
    expect(result.possible).toHaveLength(1);
    expect(result.possible[0].cycle).toBeNull();
  });
  it("não sugere transferência mesmo se o texto menciona um serviço", () => {
    const w = workspace(["Pix enviado Spotify"]);
    w.transactions[0].kind = "transfer";
    expect(analyzeDiscovery(w).candidates).toEqual([]);
  });
  it.each([
    "Pagamento efetuado",
    "Compra no débito",
    "Débito automático",
    "Pagamento de boleto",
  ])(
    "não transforma rótulo bancário genérico em comerciante: %s",
    (description) => {
      const w = workspace(
        [description, description, description],
        ["2026-08-10", "2026-09-10", "2026-10-10"],
      );
      expect(analyzeDiscovery(w).candidates).toEqual([]);
      expect(merchantFor(description).identifiable).toBe(false);
    },
  );
  it("conta uma janela de 30 dias, mesmo cruzando dois meses", () => {
    const w = workspace(["A", "B"], ["2026-09-29", "2026-10-28"]);
    expect(analyzeDiscovery(w).coverage.days).toBe(30);
  });
  it("pagamento da fatura não cria assinaturas individuais", () => {
    const w = workspace(["Pagamento de fatura"]);
    w.transactions[0].kind = "invoice_payment";
    const result = analyzeDiscovery(w);
    expect(result.coverage.invoicePayments).toBe(1);
    expect(result.coverage.eligible).toBe(0);
    expect(result.candidates).toEqual([]);
  });
  it("rejeitar uma possível assinatura esconde só aquela evidência", () => {
    const w = workspace(["Spotify"]),
      first = analyzeDiscovery(w).possible[0];
    w.decisions.push({
      key: first.key,
      evidenceHash: first.evidenceHash,
      status: "rejected",
      subscriptionId: null,
      updatedAt: new Date().toISOString(),
    });
    expect(analyzeDiscovery(w).candidates).toEqual([]);
    w.transactions.push({
      ...w.transactions[0],
      id: crypto.randomUUID(),
      date: "2026-11-01",
      sourceKey: "new-row",
    });
    expect(analyzeDiscovery(w).recurring).toHaveLength(1);
  });
});
describe("padrões financeiros conservadores", () => {
  it("uma lacuna de mês reduz a confiança mesmo em serviço reconhecido", () => {
    const result = analyzeDiscovery(
      workspace(Array(3).fill("Spotify"), [
        "2026-07-10",
        "2026-08-10",
        "2026-10-10",
      ]),
    );
    expect(result.recurring[0].cycle).toBe("monthly");
    expect(result.recurring[0].confidence).not.toBe("high");
  });
  it("histórico longo pode ser revisado sem estourar limite do fingerprint", () => {
    const w = workspace(
      Array(100).fill("GitHub"),
      Array.from({ length: 100 }, (_, i) => addMonths("2017-01-10", i)),
    );
    const c = analyzeDiscovery(w).recurring[0];
    expect(c.evidence).toHaveLength(100);
    expect(c.evidenceHash.length).toBeLessThanOrEqual(5000);
    w.decisions = [
      {
        key: c.key,
        evidenceHash: c.evidenceHash,
        status: "rejected",
        subscriptionId: null,
        updatedAt: new Date().toISOString(),
      },
    ];
    w.transactions.reverse();
    expect(analyzeDiscovery(w).candidates).toEqual([]);
  });
  it("três meses de estabelecimento estável desconhecido são revisáveis", () => {
    const result = analyzeDiscovery(
      workspace(
        ["Clube de livros", "Clube de livros", "Clube de livros"],
        ["2026-08-10", "2026-09-10", "2026-10-10"],
      ),
    );
    expect(result.recurring[0]).toMatchObject({
      cycle: "monthly",
      confidence: "medium",
      service: "",
    });
    expect(result.recurring[0].reasons.join(" ")).toContain(
      "não comprova uma assinatura",
    );
  });
  it("datas mensais respeitam o fim de fevereiro", () => {
    const result = analyzeDiscovery(
      workspace(
        ["Spotify", "Spotify", "Spotify"],
        ["2026-01-31", "2026-02-28", "2026-03-31"],
      ),
    );
    expect(result.recurring[0].cycle).toBe("monthly");
  });
  it("uma cobrança fora do calendário não impede três mensalidades consistentes", () => {
    const result = analyzeDiscovery(
      workspace(
        ["GitHub", "GitHub", "GitHub", "GitHub"],
        ["2026-07-22", "2026-08-10", "2026-09-10", "2026-10-10"],
      ),
    );
    expect(result.recurring[0].cycle).toBe("monthly");
    expect(result.recurring[0].evidence).toHaveLength(3);
  });
  it("duas ou três compras semanais não bastam; quatro semanas consecutivas sim", () => {
    const w = workspace(Array(4).fill("Serviço semanal"), [
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
    ]);
    expect(
      analyzeDiscovery({ ...w, transactions: w.transactions.slice(0, 3) })
        .candidates,
    ).toEqual([]);
    expect(analyzeDiscovery(w).recurring[0].cycle).toBe("weekly");
  });
  it("não chama pagamentos quinzenais de semanais", () => {
    const w = workspace(Array(4).fill("Fornecedor de exemplo"), [
      "2026-09-01",
      "2026-09-15",
      "2026-09-29",
      "2026-10-13",
    ]);
    expect(analyzeDiscovery(w).candidates).toEqual([]);
  });
  it("várias compras no mesmo dia não sustentam vários períodos", () => {
    const result = analyzeDiscovery(workspace(Array(4).fill("Spotify")));
    expect(result.recurring).toEqual([]);
    expect(result.possible).toHaveLength(1);
  });
  it("normaliza histórico genérico e referência explícita, sem apagar identidade", () => {
    const a = merchantFor("Clube de livros ref: 123456 · Compra no débito");
    const b = merchantFor("Clube de livros ref: 987654 · Compra no débito");
    expect(a.key).toBe(b.key);
    expect(a.identifiable).toBe(true);
    expect(merchantFor("Clube de livros").key).not.toBe(
      merchantFor("Loja de livros").key,
    );
  });
  it("preços muito diferentes em comerciantes desconhecidos não viram plano variável", () => {
    const result = analyzeDiscovery(
      workspace(
        Array(3).fill("Restaurante exemplo"),
        ["2026-08-10", "2026-09-10", "2026-10-10"],
        ["20", "150", "500"],
      ),
    );
    expect(result.candidates).toEqual([]);
  });
  it("serviço reconhecido de uso variável continua revisável", () => {
    const result = analyzeDiscovery(
      workspace(
        Array(3).fill("AWS"),
        ["2026-08-10", "2026-09-10", "2026-10-10"],
        ["20", "150", "500"],
      ),
    );
    expect(result.recurring[0]).toMatchObject({
      cycle: "monthly",
      variable: true,
      confidence: "medium",
    });
  });
  it("valor zero não quebra o motor ou produz plano gratuito", () => {
    const w = workspace(["Spotify"], ["2026-10-01"], ["0"]);
    expect(analyzeDiscovery(w).candidates).toEqual([]);
  });
});
