import { services } from "../catalog";
import { normalizeDescription } from "../transactions";

const aliases: Record<string, RegExp> = {
  openai: /\b(?:open\s*ai|chat\s*gpt)\b/,
  anthropic: /\b(?:anthropic|claude)\b/,
  github: /\b(?:github|git\s*hub)\b/,
  google: /\bgoogle\s*[*.-]?\s*(?:one|storage)\b/,
  aws: /\b(?:aws|amazon web services)\b/,
};
const generic =
  /^(?:compra(?: no| com| de)?(?: cartao)?(?: debito| credito)?|pagamento(?: efetuado| de boleto| de conta)?|debito(?: automatico| em conta)?|pix(?: enviado| recebido| entre contas)?|transferencia(?: enviada| recebida)?|saque|tarifa|iof|juros|lancamento|servico)(?:\s*[-:#]?\s*\d+)?$/;

/** Identity recognition is a review signal, never proof of a subscription. */
export function merchantFor(description: string) {
  const normalized = normalizeDescription(description)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const service = services.find((s) =>
    (aliases[s.id] ?? new RegExp(`\\b${s.id}\\b`)).test(normalized),
  );
  if (service)
    return {
      key: service.id,
      name: service.name,
      service: service.id,
      category: service.category,
      known: true,
      identifiable: true,
    };
  const parts = normalized
    .split(/\s+·\s+|\n+/)
    .map((part) =>
      part
        .replace(
          /\b(?:referencia|ref|autorizacao|auth|nsu|documento|doc|transacao)\s*[:#-]?\s*[a-z0-9-]+\b/g,
          "",
        )
        .replace(
          /^(?:compra(?: no| com)?(?: cartao)?(?: debito| credito)?|purchase|debit)\s*[:*-]?\s+/g,
          "",
        )
        .replace(/\s+[#*]?\d{6,}$/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((part) => part && !generic.test(part));
  const key = [...new Set(parts)].join(" · ");
  return {
    key,
    name: key || "Estabelecimento não identificado",
    service: "",
    category: "Outros",
    known: false,
    identifiable: key.length >= 4 && /[a-z]{3}/.test(key),
  };
}
