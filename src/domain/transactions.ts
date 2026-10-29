import type { Transaction } from "./model";

export function normalizeDescription(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function transactionKind(
  description: string,
  direction: "debit" | "credit",
): Transaction["kind"] {
  const d = normalizeDescription(description);
  if (/pagamento.{0,15}fatura|payment.{0,10}credit card/.test(d))
    return "invoice_payment";
  if (/transfer[eê]ncia|pix (?:entre contas|enviado|recebido)/.test(d))
    return "transfer";
  if (direction === "credit")
    return /estorno|reembolso|refund|devolu[cç][aã]o/.test(d)
      ? "refund"
      : "income";
  const part = d.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (
    /parcela|parcelamento/.test(d) ||
    (part && +part[1] > 0 && +part[1] <= +part[2] && +part[2] <= 24)
  )
    return "installment";
  return "expense";
}

export const transactionKindLabels: Record<Transaction["kind"], string> = {
  expense: "Despesa",
  refund: "Estorno",
  income: "Entrada",
  transfer: "Transferência",
  invoice_payment: "Pagamento de fatura",
  installment: "Parcela",
};
