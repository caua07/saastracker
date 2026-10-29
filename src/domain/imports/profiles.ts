import type { CsvMapping } from "./types";

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function suggestMapping(fields: string[]): CsvMapping {
  const find = (patterns: RegExp[]) =>
    patterns
      .map((p) => fields.find((f) => p.test(normalizeHeader(f))))
      .find(Boolean) ?? "";
  const description = find([
    /^(descricao|description|estabelecimento|nome|title|lancamento)$/,
    /^historico$/,
  ]);
  const details = find([/^historico$/, /^(detalhes|complemento)$/]);
  return {
    date: find([
      /^(data(?: (?:de |do |da )?(?:lancamento|movimento|compra|transacao))?|date|posted_at)$/,
    ]),
    description,
    details: details === description ? "" : details,
    amount: find([/^(valor(?: \(r\$\)| em r\$| \(brl\))?|amount|value)$/]),
    debit: find([/^(debito(?: \(r\$\))?|saida(?:s)?|debit)$/]),
    credit: find([/^(credito(?: \(r\$\))?|entrada(?:s)?|credit)$/]),
    currency: find([/^(currency|moeda)$/]),
    id: find([
      /^(id|fitid|identificador|id (?:da )?transacao|numero do documento)$/,
    ]),
    account: "Inter · Conta",
    defaultCurrency: "BRL",
    dateFormat: "dmy",
    debitSign: "negative",
    numberFormat: "auto",
  };
}
export function headerScore(fields: string[]) {
  const m = suggestMapping(fields);
  return (
    Number(!!m.date) +
    Number(!!m.description) +
    Number(!!m.amount || !!(m.debit && m.credit))
  );
}
export function csvProfile(fields: string[]) {
  const m = suggestMapping(fields);
  const bankLayout =
    headerScore(fields) === 3 &&
    fields.some((f) => /^saldo(?: \(r\$\))?$/.test(normalizeHeader(f)));
  return {
    label: bankLayout ? "Extrato de conta · padrão Inter" : "CSV personalizado",
    recognized: bankLayout,
    mapping: {
      ...m,
      numberFormat: bankLayout ? ("br" as const) : ("auto" as const),
    },
  };
}
