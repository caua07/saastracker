import { workspaceSchema, type Workspace } from "../model";
import { previewCsv } from "./preview";
import type { CsvFile, CsvMapping } from "./types";
import { CSV_LIMITS } from "./types";

export function prepareCsvImport(
  file: CsvFile,
  mapping: CsvMapping,
  workspace: Workspace,
  batch: { id: string; name: string; hash: string },
  options: { allowPartial: boolean; excluded: Set<number> },
) {
  const preview = previewCsv(
    file,
    mapping,
    workspace,
    batch.id,
    options.excluded,
  );
  if (preview.blocking)
    throw new Error(
      "Há um problema na estrutura do CSV. Corrija o arquivo antes de importar.",
    );
  if (preview.invalid && !options.allowPartial)
    throw new Error(
      "Revise as linhas com erro ou autorize importar apenas as válidas.",
    );
  if (!preview.rows.length)
    throw new Error("Não há movimentos novos para importar.");
  if (workspace.transactions.length + preview.rows.length > 50_000)
    throw new Error(
      "A importação ultrapassa o limite de 50 mil movimentos do seu espaço.",
    );
  if (workspace.imports.length >= 1_000)
    throw new Error("Seu espaço atingiu o limite de mil importações.");
  const next = {
    ...workspace,
    transactions: [...workspace.transactions, ...preview.rows],
    imports: [
      ...workspace.imports,
      {
        ...batch,
        count: preview.rows.length,
        createdAt: new Date().toISOString(),
        source: "csv" as const,
      },
    ],
  };
  const parsed = workspaceSchema.safeParse(next);
  if (!parsed.success)
    throw new Error(
      "O lote não passou pela validação. Nenhum movimento foi salvo.",
    );
  if (
    new TextEncoder().encode(JSON.stringify(next)).byteLength > CSV_LIMITS.bytes
  )
    throw new Error(
      "Seus dados ultrapassariam o limite de envio de 10 MB. Importe um período menor.",
    );
  return { workspace: parsed.data, preview };
}
