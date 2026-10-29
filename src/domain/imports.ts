import Papa from "papaparse";
import Decimal from "decimal.js";
import type { Currency, Transaction, Workspace } from "./model";
import { z } from "zod";

export type CsvMapping = {
  date: string;
  description: string;
  amount: string;
  currency: string;
  id: string;
  account: string;
  defaultCurrency: Currency;
  dateFormat: "dmy" | "mdy";
  debitSign: "negative" | "positive";
};
export type CsvFile = {
  fields: string[];
  rows: Record<string, string>[];
  errors: string[];
};
export function readCsv(text: string): CsvFile {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error("O arquivo deve ter até 10 MB.");
  const parsed = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  if (parsed.data.length > 20000)
    throw new Error("Importe no máximo 20 mil linhas por vez.");
  return {
    fields: parsed.meta.fields ?? [],
    rows: parsed.data,
    errors: parsed.errors.map((e) => `Linha ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}
export function suggestMapping(fields: string[]): CsvMapping {
  const find = (pattern: RegExp) =>
    fields.find((f) =>
      pattern.test(
        f
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      ),
    ) ?? "";
  return {
    date: find(/^(date|data|data da compra|posted_at)$/),
    description: find(/^(description|descricao|historico|title|nome)$/),
    amount: find(/^(amount|valor|value)$/),
    currency: find(/^(currency|moeda)$/),
    id: find(/^(id|fitid|identificador)$/),
    account: "Cartão principal",
    defaultCurrency: "BRL",
    dateFormat: "dmy",
    debitSign: "negative",
  };
}
export function parseAmount(input: string): Decimal {
  let text = input.trim().replace(/[R$US\s]/g, "");
  const negative = text.startsWith("(") && text.endsWith(")");
  text = text.replace(/[()]/g, "");
  if (text.includes(",") && text.includes(".")) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (text.includes(",")) text = text.replace(",", ".");
  if (!/^-?\d+(\.\d{1,6})?$/.test(text))
    throw new Error("valor inválido ou ambíguo");
  const value = new Decimal(text);
  if (value.abs().gte("10000000000")) throw new Error("valor acima do limite");
  return negative ? value.abs().neg() : value;
}
export function parseCsvDate(input: string, format: "dmy" | "mdy"): string {
  const text = input.trim();
  if (z.iso.date().safeParse(text).success) return text;
  const parts = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!parts)
    throw new Error("data inválida (use AAAA-MM-DD ou data completa)");
  const [, a, b, year] = parts;
  const day = format === "dmy" ? a : b,
    month = format === "dmy" ? b : a;
  const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!z.iso.date().safeParse(result).success) throw new Error("data inválida");
  return result;
}
export function normalizeDescription(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
export function transactionKind(
  description: string,
  direction: "debit" | "credit",
): Transaction["kind"] {
  const d = normalizeDescription(description);
  if (
    /pagamento.{0,15}fatura|pagamento recebido|payment.{0,10}credit card/.test(
      d,
    )
  )
    return "invoice_payment";
  if (/transfer[eê]ncia|transferencia|pix entre contas/.test(d))
    return "transfer";
  if (/\b\d{1,2}\s*\/\s*\d{2}\b|parcela/.test(d)) return "installment";
  return direction === "credit" ? "refund" : "expense";
}
export function previewCsv(
  file: CsvFile,
  mapping: CsvMapping,
  workspace: Workspace,
  importId: string,
) {
  const errors = [...file.errors];
  const rows: Transaction[] = [];
  let duplicates = 0;
  const seen = new Map<string, number>();
  const existing = new Set(workspace.transactions.map((t) => t.sourceKey));
  if (
    !mapping.date ||
    !mapping.description ||
    !mapping.amount ||
    !mapping.account.trim()
  )
    throw new Error("Escolha as colunas e a conta de origem.");
  file.rows.forEach((row, i) => {
    try {
      const date = parseCsvDate(row[mapping.date] ?? "", mapping.dateFormat);
      const description = (row[mapping.description] ?? "").trim();
      if (!description || description.length > 300)
        throw new Error("descrição ausente ou longa demais");
      const signed = parseAmount(row[mapping.amount] ?? "");
      if (signed.isZero()) return;
      const direction = (
        mapping.debitSign === "negative"
          ? signed.isNegative()
          : signed.isPositive()
      )
        ? "debit"
        : "credit";
      const rawCurrency = (
        mapping.currency ? row[mapping.currency] : mapping.defaultCurrency
      )
        ?.trim()
        .toUpperCase();
      if (rawCurrency !== "USD" && rawCurrency !== "BRL")
        throw new Error("moeda deve ser BRL ou USD");
      const amount = signed.abs().toFixed();
      const account = mapping.account.trim();
      const base = [
        normalizeDescription(account),
        date,
        normalizeDescription(description),
        amount,
        rawCurrency,
        direction,
      ].join("|");
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const external = mapping.id ? row[mapping.id]?.trim() : "";
      const sourceKey = external
        ? `csv|${normalizeDescription(account)}|id:${external}`
        : `csv|${base}|${n}`;
      if (
        existing.has(sourceKey) ||
        rows.some((t) => t.sourceKey === sourceKey)
      ) {
        duplicates++;
        return;
      }
      rows.push({
        id: crypto.randomUUID(),
        date,
        description,
        amount,
        currency: rawCurrency,
        direction,
        kind: transactionKind(description, direction),
        account,
        sourceKey,
        importId,
        subscriptionId: null,
        pending: false,
      });
    } catch (error) {
      errors.push(
        `Linha ${i + 2}: ${error instanceof Error ? error.message : "não foi possível ler"}.`,
      );
    }
  });
  return { rows, errors, duplicates };
}
export async function fileHash(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buffer))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function subscriptionsCsv(workspace: Workspace): string {
  const safe = (v: string) => (/^[=+@\-\t\r]/.test(v) ? `'${v}` : v);
  return Papa.unparse(
    {
      fields: [
        "Serviço",
        "Valor",
        "Moeda",
        "Ciclo",
        "Categoria",
        "Status",
        "Próxima referência",
      ],
      data: workspace.subscriptions.map((s) => [
        safe(s.name),
        s.amount,
        s.currency,
        s.cycle,
        safe(s.category),
        s.status,
        s.anchorDate,
      ]),
    },
    { delimiter: ";" },
  );
}
