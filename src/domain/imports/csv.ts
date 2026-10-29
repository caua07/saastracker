import Papa from "papaparse";
import { CSV_LIMITS, type CsvFile, type CsvIssue, type CsvRow } from "./types";
import { headerScore, normalizeHeader } from "./profiles";

const blank = (cells: string[]) => cells.every((v) => !v.trim());
const trimTail = (cells: string[]) => {
  const copy = [...cells];
  while (copy.length && !copy.at(-1)!.trim()) copy.pop();
  return copy;
};
const lineCount = (text: string) => (text.match(/\r\n|\r|\n/g) ?? []).length;
const footer = (cells: string[]) =>
  /^(saldo (?:anterior|final|disponivel|do dia|em conta)|total de (?:entradas|saidas|creditos|debitos)|extrato gerado em)(?:\s*:.*)?$/.test(
    normalizeHeader(cells.find((v) => v.trim()) ?? ""),
  );

export function readCsv(input: string): CsvFile {
  if (new TextEncoder().encode(input).length > CSV_LIMITS.bytes)
    throw new Error("O arquivo deve ter até 10 MB.");
  const text = input.replace(/^\uFEFF/, "");
  if (!text.trim())
    throw new Error("O arquivo está vazio. Exporte o extrato novamente.");
  const separator = text.match(/^sep=([;,\t|])\s*(?:\r\n|\n|\r)/i);
  const candidates = (separator ? [separator[1]] : [";", ",", "\t", "|"])
    .map((delimiter) => {
      const sample = Papa.parse<string[]>(text, {
        delimiter,
        preview: 100,
        skipEmptyLines: false,
      }).data;
      const header = sample.findIndex((cells) => headerScore(cells) === 3);
      return { delimiter, sample, header, score: header >= 0 ? 3 : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best.score && candidates[1]?.score === best.score)
    throw new Error(
      "Separador ambíguo. Exporte um CSV com vírgula, ponto e vírgula ou tabulação.",
    );
  if (!best.score) {
    // Unknown columns remain manually mappable, but never treat arbitrary text as a CSV.
    const fallback = candidates.find((candidate) =>
      candidate.sample.some((cells) => trimTail(cells).length >= 3),
    );
    if (!fallback)
      throw new Error(
        "Não encontramos uma tabela CSV. Exporte data, descrição e valor com cabeçalho.",
      );
    Object.assign(best, fallback, {
      header: fallback.sample.findIndex((cells) => trimTail(cells).length >= 3),
    });
  }
  const fields = trimTail(best.sample[best.header]).map(
    (s, i) => s.trim() || `Coluna ${i + 1}`,
  );
  if (fields.length > CSV_LIMITS.columns)
    throw new Error("O CSV tem colunas demais. O limite é de 100 colunas.");
  const issues: CsvIssue[] = [];
  if (new Set(fields.map(normalizeHeader)).size !== fields.length)
    throw new Error(
      "Há cabeçalhos repetidos. Dê um nome diferente a cada coluna antes de importar.",
    );
  const rows: CsvRow[] = [];
  let record = 0,
    cursor = 0,
    physicalLine = 1,
    headerLine = 1,
    footerRows = 0;
  Papa.parse<string[]>(text, {
    delimiter: best.delimiter,
    skipEmptyLines: false,
    step(result, parser) {
      const line = physicalLine;
      physicalLine += lineCount(text.slice(cursor, result.meta.cursor));
      cursor = result.meta.cursor;
      const index = record++;
      if (index < best.header) return;
      if (index === best.header) {
        headerLine = line;
        return;
      }
      if (blank(result.data)) return;
      if (rows.length >= CSV_LIMITS.rows) {
        parser.abort();
        throw new Error("Importe no máximo 20 mil linhas por vez.");
      }
      const cells = [...result.data];
      while (cells.length > fields.length && !cells.at(-1)!.trim()) cells.pop();
      const values = Object.fromEntries(
        fields.map((field, i) => [field, cells[i] ?? ""]),
      );
      const quotes = result.errors.some((e) => e.type === "Quotes");
      if (quotes)
        issues.push({
          line,
          code: "quotes",
          message:
            "Aspas não fechadas ou inválidas. Corrija o arquivo antes de importar.",
          blocking: true,
        });
      if (!quotes && footer(cells)) {
        footerRows++;
        rows.push({
          line,
          values,
          ignored: "Resumo de saldo; não é uma movimentação.",
        });
        return;
      }
      rows.push({
        line,
        values,
        ...(quotes || cells.length !== fields.length
          ? {
              issue: {
                line,
                code: quotes ? "quotes" : "columns",
                message: quotes
                  ? "Aspas inválidas nesta linha."
                  : `Esperadas ${fields.length} colunas; encontradas ${cells.length}. Confira separadores e aspas.`,
              },
            }
          : {}),
      });
    },
  });
  if (!rows.length)
    throw new Error(
      "O cabeçalho foi encontrado, mas não há movimentos no arquivo.",
    );
  return {
    fields,
    rows,
    issues,
    errors: issues.map((e) => `Linha ${e.line}: ${e.message}`),
    delimiter: best.delimiter,
    headerLine,
    preambleLines: headerLine - 1,
    footerRows,
  };
}
