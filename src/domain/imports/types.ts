import type { Currency, Transaction } from "../model";

export const CSV_LIMITS = {
  bytes: 10 * 1024 * 1024,
  rows: 20_000,
  columns: 100,
} as const;
export type NumberFormat = "auto" | "br" | "us";
export type CsvMapping = {
  date: string;
  description: string;
  details: string;
  amount: string;
  debit: string;
  credit: string;
  currency: string;
  id: string;
  account: string;
  defaultCurrency: Currency;
  dateFormat: "dmy" | "mdy";
  debitSign: "negative" | "positive";
  numberFormat: NumberFormat;
};
export type CsvIssue = {
  line?: number;
  code: string;
  message: string;
  blocking?: boolean;
};
export type CsvRow = {
  line: number;
  values: Record<string, string>;
  issue?: CsvIssue;
  ignored?: string;
};
export type CsvFile = {
  fields: string[];
  rows: CsvRow[];
  issues: CsvIssue[];
  errors: string[];
  delimiter: string;
  headerLine: number;
  preambleLines: number;
  footerRows: number;
};
export type CsvEntry = {
  line: number;
  status: "ready" | "duplicate" | "invalid" | "ignored" | "excluded";
  description: string;
  message: string;
  transaction?: Transaction;
};
export type CsvPreview = {
  rows: Transaction[];
  errors: string[];
  issues: CsvIssue[];
  entries: CsvEntry[];
  duplicates: number;
  ignored: number;
  invalid: number;
  excluded: number;
  blocking: boolean;
  warnings: string[];
  totals: { currency: Currency; debit: string; credit: string }[];
  period: { from: string; to: string } | null;
};
