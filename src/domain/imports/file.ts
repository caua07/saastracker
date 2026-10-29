import { CSV_LIMITS } from "./types";

export function decodeCsvBytes(bytes: Uint8Array) {
  if (bytes.byteLength > CSV_LIMITS.bytes)
    throw new Error("O arquivo deve ter até 10 MB.");
  if (!bytes.byteLength)
    throw new Error("O arquivo está vazio. Exporte o extrato novamente.");
  let text: string,
    encoding = "UTF-8";
  if (
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff)
  ) {
    encoding = bytes[0] === 0xff ? "UTF-16 LE" : "UTF-16 BE";
    try {
      text = new TextDecoder(bytes[0] === 0xff ? "utf-16le" : "utf-16be", {
        fatal: true,
      }).decode(bytes);
    } catch {
      throw new Error(
        "Codificação UTF-16 inválida. Exporte o arquivo como CSV UTF-8.",
      );
    }
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      encoding = "Windows-1252";
      text = new TextDecoder("windows-1252").decode(bytes);
    }
  }
  if (
    text.includes("\0") ||
    /^\s*(?:%PDF|PK\x03\x04|<!doctype|<html)/i.test(text)
  )
    throw new Error(
      "Este arquivo não é um CSV de texto. Selecione o extrato exportado em CSV.",
    );
  if (text.includes("\uFFFD"))
    throw new Error(
      "O arquivo contém caracteres ilegíveis. Exporte como CSV UTF-8.",
    );
  return { text, encoding };
}

export async function fileHash(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

export async function readCsvUpload(file: File) {
  if (!/\.csv$/i.test(file.name))
    throw new Error(
      "Selecione um arquivo .csv. PDF, OFX e planilhas não são aceitos aqui.",
    );
  if (file.size > CSV_LIMITS.bytes)
    throw new Error("O arquivo deve ter até 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    ...decodeCsvBytes(bytes),
    hash: await fileHash(bytes),
    name: file.name.slice(0, 150),
  };
}
