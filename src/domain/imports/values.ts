import Decimal from "decimal.js";
import { z } from "zod";
import type { NumberFormat } from "./types";

/** No float conversion or removal of arbitrary letters; punctuation must be unambiguous. */
export function parseAmount(
  input: string,
  format: NumberFormat = "auto",
): Decimal {
  let text = input.trim().replace(/\u2212/g, "-");
  const marker = text.match(/\s+([DC])$/i)?.[1]?.toUpperCase();
  if (marker) text = text.replace(/\s+[DC]$/i, "").trim();
  const parentheses = /^\(.*\)$/.test(text);
  if (parentheses) text = text.slice(1, -1).trim();
  text = text.replace(/^(R\$|US\$|BRL|USD|\$)\s*/i, "").trim();
  let sign = "";
  if (/^[+-]/.test(text)) {
    sign = text[0];
    text = text.slice(1).trim();
    text = text.replace(/^(R\$|US\$|BRL|USD|\$)\s*/i, "").trim();
  }
  if (!text || /\s|[()]/.test(text) || (parentheses && sign))
    throw new Error("valor inválido; confira sinais e separadores");
  if (marker && (parentheses || sign))
    throw new Error("valor com sinais conflitantes");
  let chosen = format;
  if (chosen === "auto") {
    if (text.includes(",") && text.includes("."))
      chosen = text.lastIndexOf(",") > text.lastIndexOf(".") ? "br" : "us";
    else {
      if (/^\d+[.,]\d{3}$/.test(text))
        throw new Error(
          "valor ambíguo; escolha o formato brasileiro ou americano nos ajustes",
        );
      chosen = text.includes(",") ? "br" : "us";
    }
  }
  const pattern =
    chosen === "br"
      ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,6})?$/
      : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,6})?$/;
  if (!pattern.test(text))
    throw new Error("valor inválido para o formato numérico escolhido");
  text =
    chosen === "br"
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  const value = new Decimal(text);
  if (value.gte("10000000000")) throw new Error("valor acima do limite");
  return parentheses || sign === "-" || marker === "D" ? value.neg() : value;
}

export function parseCsvDate(input: string, format: "dmy" | "mdy"): string {
  const text = input.trim();
  if (z.iso.date().safeParse(text).success) return text;
  const parts = text.match(/^(\d{1,2})([/.\-])(\d{1,2})\2(\d{4})$/);
  if (!parts)
    throw new Error(
      "data inválida; use uma data completa, com ano de quatro dígitos",
    );
  const [, a, , b, year] = parts;
  const day = format === "dmy" ? a : b,
    month = format === "dmy" ? b : a;
  const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!z.iso.date().safeParse(result).success)
    throw new Error("data inexistente no calendário");
  return result;
}
