import { describe, expect, it } from "vitest";
import { emptyWorkspace, type Workspace } from "@/domain/model";
import { readCsv } from "@/domain/imports/csv";
import { csvProfile } from "@/domain/imports/profiles";
import { prepareCsvImport } from "@/domain/imports/commit";
import { analyzeDiscovery } from "@/domain/recurrence";
import { compareStatementPeriods } from "@/domain/discovery/periods";
import {
  nextScheduledDate,
  nextUnobservedDate,
} from "@/domain/discovery/schedule";

function importMonth(w: Workspace, lines: string[], account = "Inter · Conta") {
  const csv = readCsv(
    ["Data;Histórico;Descrição;Valor;Saldo", ...lines].join("\n"),
  );
  const mapping = { ...csvProfile(csv.fields).mapping, account };
  return prepareCsvImport(
    csv,
    mapping,
    w,
    {
      id: crypto.randomUUID(),
      name: "arquivo-sem-mes.csv",
      hash: crypto.randomUUID(),
    },
    { allowPartial: false, excluded: new Set() },
  ).workspace;
}
const charge = (date: string, name = "Clube de leitura", amount = "49,90") =>
  `${date};Compra no débito;${name};-${amount};1000,00`;

describe("comparação automática de extratos mensais", () => {
  it("cruza três arquivos fora de ordem, reconhece dia e preserva datas originais", () => {
    let w = importMonth(emptyWorkspace(), [charge("10/10/2026")]);
    expect(analyzeDiscovery(w).recurring).toHaveLength(0);
    w = importMonth(w, [charge("10/08/2026")]);
    expect(analyzeDiscovery(w).recurring).toHaveLength(0);
    w = importMonth(w, [charge("11/09/2026")]);
    const report = analyzeDiscovery(w);
    expect(report.history[0]).toMatchObject({
      account: "Inter · Conta",
      missingMonths: 0,
    });
    expect(report.history[0].months.map((m) => m.month)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(report.recurring).toHaveLength(1);
    expect(report.recurring[0].schedule).toEqual({
      anchorDate: "2026-08-10",
      lastDate: "2026-10-10",
      nextDate: "2026-11-10",
      tolerance: 4,
      maxDeviation: 1,
      months: ["2026-08", "2026-09", "2026-10"],
    });
    expect(report.recurring[0].evidence.map((t) => t.date)).toEqual([
      "2026-08-10",
      "2026-09-11",
      "2026-10-10",
    ]);
    expect(report.recurring[0].reasons.join(" ")).toContain(
      "dia 10 de cada mês",
    );
  });
  it("uma cobrança adiantada ocupa o mês e não prevê outra no dia nominal", () => {
    const w = importMonth(emptyWorkspace(), [
      charge("10/08/2026"),
      charge("11/09/2026"),
      charge("09/10/2026"),
    ]);
    const c = analyzeDiscovery(w).recurring[0];
    expect(c.schedule?.nextDate).toBe("2026-11-10");
    expect(nextUnobservedDate(c.schedule!, c.cycle!, "2026-10-09")).toBe(
      "2026-11-10",
    );
    expect(nextUnobservedDate(c.schedule!, c.cycle!, "2026-10-10")).toBe(
      "2026-11-10",
    );
    expect(nextUnobservedDate(c.schedule!, c.cycle!, "2026-12-01")).toBe(
      "2026-12-10",
    );
  });
  it("dois extratos reconhecidos promovem uma possibilidade a padrão", () => {
    let w = importMonth(emptyWorkspace(), [charge("10/10/2026", "Spotify")]);
    expect(analyzeDiscovery(w).possible).toHaveLength(1);
    w = importMonth(w, [charge("10/09/2026", "Spotify")]);
    expect(analyzeDiscovery(w).possible).toHaveLength(0);
    expect(analyzeDiscovery(w).recurring[0].cycle).toBe("monthly");
  });
  it("extratos sobrepostos não criam evidência extra nem duplicam cobranças", () => {
    let w = importMonth(emptyWorkspace(), [
      charge("10/08/2026"),
      charge("10/09/2026"),
    ]);
    w = importMonth(w, [charge("10/09/2026"), charge("10/10/2026")]);
    expect(w.transactions).toHaveLength(3);
    expect(analyzeDiscovery(w).recurring[0].evidence).toHaveLength(3);
    expect(
      analyzeDiscovery(w).history[0].months.every((m) => m.count === 1),
    ).toBe(true);
  });
  it("compras no mesmo mês não são três meses de evidência", () => {
    const w = importMonth(emptyWorkspace(), [
      charge("01/10/2026"),
      charge("10/10/2026"),
      charge("20/10/2026"),
    ]);
    expect(analyzeDiscovery(w).recurring).toHaveLength(0);
    expect(analyzeDiscovery(w).history[0].months).toHaveLength(1);
  });
  it("datas mensais irregulares não viram mensalidade só por repetirem valor", () => {
    const w = importMonth(emptyWorkspace(), [
      charge("02/08/2026"),
      charge("16/09/2026"),
      charge("28/10/2026"),
    ]);
    expect(analyzeDiscovery(w).recurring).toHaveLength(0);
  });
  it("mantém contas e moedas separadas e sinaliza lacuna sem presumir cobertura", () => {
    let w = importMonth(emptyWorkspace(), [charge("10/08/2026", "Spotify")]);
    w = importMonth(w, [charge("10/10/2026", "Spotify")]);
    w = importMonth(w, [charge("10/09/2026", "Spotify")], "Outro banco");
    const report = analyzeDiscovery(w);
    expect(report.history).toHaveLength(2);
    expect(
      report.history.find((h) => h.account === "Inter · Conta")?.missingMonths,
    ).toBe(1);
    expect(report.recurring).toHaveLength(0);
    w.transactions[1].currency = "USD";
    expect(analyzeDiscovery(w).recurring).toHaveLength(0);
  });
  it("prévia detecta meses novos pelas linhas selecionadas sem modificar histórico", () => {
    const w = importMonth(emptyWorkspace(), [charge("10/10/2026")]);
    const next = importMonth(emptyWorkspace(), [
      charge("10/08/2026"),
      charge("10/10/2026"),
    ]);
    expect(
      compareStatementPeriods(
        w.transactions,
        next.transactions,
        "Inter · Conta",
      ),
    ).toMatchObject({
      priorMonths: 1,
      totalMonths: 2,
      newMonths: [{ month: "2026-08", count: 1 }],
    });
    expect(w.transactions).toHaveLength(1);
  });
  it("janeiro 31 e fevereiro 28 mantêm o dia 31 para março", () => {
    const w = importMonth(emptyWorkspace(), [
      charge("31/01/2026", "Spotify"),
      charge("28/02/2026", "Spotify"),
    ]);
    const candidate = analyzeDiscovery(w).recurring[0];
    expect(candidate.schedule?.anchorDate).toBe("2026-01-31");
    expect(
      nextScheduledDate(
        candidate.schedule!.anchorDate,
        "monthly",
        "2026-03-01",
      ),
    ).toBe("2026-03-31");
  });
  it.each([
    ["2026-10-10", "monthly", "2026-10-29", "2026-11-10"],
    ["2026-10-10", "monthly", "2026-11-10", "2026-11-10"],
    ["2026-10-10", "weekly", "2026-10-18", "2026-10-24"],
    ["2026-10-10", "quarterly", "2026-10-29", "2027-01-10"],
    ["2024-02-29", "yearly", "2028-01-01", "2028-02-29"],
  ] as const)(
    "projeta %s %s a partir de %s",
    (anchor, cycle, from, expected) => {
      expect(nextScheduledDate(anchor, cycle, from)).toBe(expected);
    },
  );
});
