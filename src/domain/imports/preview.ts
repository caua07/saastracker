import Decimal from "decimal.js";
import type { Currency, Transaction, Workspace } from "../model";
import { transactionSchema } from "../model";
import { normalizeDescription, transactionKind } from "../transactions";
import { parseAmount, parseCsvDate } from "./values";
import type { CsvEntry, CsvFile, CsvMapping, CsvPreview } from "./types";

function fingerprint(t: Transaction) {
  return [
    normalizeDescription(t.account),
    t.date,
    normalizeDescription(t.description),
    new Decimal(t.amount).toFixed(),
    t.currency,
    t.direction,
  ].join("|");
}
export function previewCsv(
  file: CsvFile,
  mapping: CsvMapping,
  workspace: Workspace,
  importId: string,
  excluded = new Set<number>(),
): CsvPreview {
  const selected = [
    mapping.date,
    mapping.description,
    mapping.details,
    ...(mapping.amount ? [mapping.amount] : [mapping.debit, mapping.credit]),
    mapping.currency,
    mapping.id,
  ].filter(Boolean);
  if (
    !mapping.date ||
    !mapping.description ||
    (!mapping.amount && !(mapping.debit && mapping.credit)) ||
    !mapping.account.trim()
  )
    throw new Error(
      "Escolha data, descrição, valor (ou débito e crédito) e a conta de origem.",
    );
  if (selected.some((field) => !file.fields.includes(field)))
    throw new Error(
      "Uma coluna selecionada não existe neste arquivo. Confira os ajustes.",
    );
  if (new Set(selected).size !== selected.length)
    throw new Error(
      "Cada informação precisa de uma coluna diferente. Confira os ajustes.",
    );
  if (mapping.account.trim().length > 100)
    throw new Error("O nome da conta deve ter até 100 caracteres.");
  const issues = [...file.issues],
    entries: CsvEntry[] = [],
    rows: Transaction[] = [];
  const existing = new Map(workspace.transactions.map((t) => [t.sourceKey, t]));
  const seen = new Map<string, number>();
  const totals = new Map<Currency, { debit: Decimal; credit: Decimal }>();
  for (const row of file.rows) {
    const rawDescription = row.values[mapping.description]?.trim() ?? "";
    if (row.ignored) {
      entries.push({
        line: row.line,
        status: "ignored",
        description: "Resumo do extrato",
        message: row.ignored,
      });
      continue;
    }
    try {
      if (row.issue) throw new Error(row.issue.message);
      const date = parseCsvDate(
        row.values[mapping.date] ?? "",
        mapping.dateFormat,
      );
      const detail = mapping.details ? row.values[mapping.details]?.trim() : "";
      const description = [
        ...new Set([rawDescription, detail].filter(Boolean)),
      ].join(" · ");
      if (!description || description.length > 300)
        throw new Error("descrição ausente ou com mais de 300 caracteres");
      let signed: Decimal, direction: Transaction["direction"];
      if (mapping.amount) {
        signed = parseAmount(
          row.values[mapping.amount] ?? "",
          mapping.numberFormat,
        );
        direction = (
          mapping.debitSign === "negative"
            ? signed.isNegative()
            : signed.isPositive()
        )
          ? "debit"
          : "credit";
      } else {
        const debit = row.values[mapping.debit]?.trim(),
          credit = row.values[mapping.credit]?.trim();
        const d = debit
            ? parseAmount(debit, mapping.numberFormat)
            : new Decimal(0),
          c = credit
            ? parseAmount(credit, mapping.numberFormat)
            : new Decimal(0);
        if (!d.isZero() && !c.isZero())
          throw new Error(
            "débito e crédito preenchidos na mesma linha; confira o movimento",
          );
        signed = d.isZero() ? c : d;
        direction = d.isZero() ? "credit" : "debit";
      }
      if (signed.isZero()) {
        entries.push({
          line: row.line,
          status: "ignored",
          description,
          message: "Valor zero; nenhum movimento financeiro.",
        });
        continue;
      }
      const currency = (
        mapping.currency
          ? row.values[mapping.currency]
          : mapping.defaultCurrency
      )
        ?.trim()
        .toUpperCase();
      if (currency !== "BRL" && currency !== "USD")
        throw new Error(
          "moeda deve ser BRL ou USD; confira a coluna ou a moeda padrão",
        );
      const originalValue = mapping.amount
        ? row.values[mapping.amount]
        : `${row.values[mapping.debit] ?? ""} ${row.values[mapping.credit] ?? ""}`;
      if (
        (/(?:USD|US\$)/i.test(originalValue) && currency !== "USD") ||
        (/(?:BRL|R\$)/i.test(originalValue) && currency !== "BRL")
      )
        throw new Error(
          "a moeda escrita no valor difere da moeda selecionada; confira os ajustes",
        );
      const amount = signed.abs().toFixed(),
        account = mapping.account.trim();
      const base = [
        normalizeDescription(account),
        date,
        normalizeDescription(description),
        amount,
        currency,
        direction,
      ].join("|");
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      const external = mapping.id ? row.values[mapping.id]?.trim() : "";
      if (mapping.id && !external)
        throw new Error(
          "ID ausente na coluna selecionada; remova o mapeamento de ID ou corrija a linha",
        );
      if (external && external.length > 300)
        throw new Error("ID com mais de 300 caracteres");
      const sourceKey = external
        ? `csv|${normalizeDescription(account)}|id:${external}`
        : `csv|${base}|${occurrence}`;
      const transaction = {
        id: crypto.randomUUID(),
        date,
        description,
        amount,
        currency,
        direction,
        kind: transactionKind(description, direction),
        account,
        sourceKey,
        importId,
        subscriptionId: null,
        pending: false,
      } satisfies Transaction;
      const validation = transactionSchema.safeParse(transaction);
      if (!validation.success)
        throw new Error(
          "movimento fora dos limites permitidos; confira as colunas",
        );
      const prior = existing.get(sourceKey);
      if (prior) {
        if (fingerprint(prior) !== base)
          throw new Error(
            "o mesmo ID já existe com dados diferentes; revise o lançamento antes de importar",
          );
        entries.push({
          line: row.line,
          status: "duplicate",
          description,
          transaction,
          message: "Já registrado nesta conta; não será importado novamente.",
        });
        continue;
      }
      // Reserve occurrences even for excluded rows, so identical legitimate movements keep their identity.
      existing.set(sourceKey, transaction);
      if (excluded.has(row.line)) {
        entries.push({
          line: row.line,
          status: "excluded",
          description,
          transaction,
          message: "Retirado por você desta importação.",
        });
        continue;
      }
      entries.push({
        line: row.line,
        status: "ready",
        description,
        transaction,
        message: "Pronto para importar.",
      });
      rows.push(transaction);
      const sum = totals.get(currency) ?? {
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      sum[direction] = sum[direction].add(amount);
      totals.set(currency, sum);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível ler esta linha.";
      issues.push({
        line: row.line,
        code: row.issue?.code ?? "value",
        message,
      });
      entries.push({
        line: row.line,
        status: "invalid",
        description: rawDescription || "Linha sem descrição",
        message,
      });
    }
  }
  const dates = rows.map((t) => t.date).sort();
  return {
    rows,
    entries,
    issues,
    errors: issues.map(
      (e) => `${e.line ? `Linha ${e.line}: ` : ""}${e.message}`,
    ),
    blocking: issues.some((e) => e.blocking),
    duplicates: entries.filter((e) => e.status === "duplicate").length,
    ignored: entries.filter((e) => e.status === "ignored").length,
    invalid: entries.filter((e) => e.status === "invalid").length,
    excluded: entries.filter((e) => e.status === "excluded").length,
    warnings: mapping.id
      ? []
      : [
          "Sem ID bancário, a conciliação compara conta, data, descrição, valor e quantidade. Movimentos idênticos em extratos diferentes podem ser ambíguos.",
        ],
    totals: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, sum]) => ({
        currency,
        debit: sum.debit.toFixed(),
        credit: sum.credit.toFixed(),
      })),
    period: dates.length ? { from: dates[0], to: dates.at(-1)! } : null,
  };
}
