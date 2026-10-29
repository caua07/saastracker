"use client";
import { useRef, useState } from "react";
import {
  FileUp,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import {
  readCsv,
  suggestMapping,
  previewCsv,
  fileHash,
  type CsvFile,
  type CsvMapping,
} from "@/domain/imports";
import type { Workspace } from "@/domain/model";
import { money } from "@/domain/finance";
import { Button } from "./ui";

export function ImportPanel({
  workspace,
  onCommit,
  busy,
}: {
  workspace: Workspace;
  onCommit: (next: Workspace, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<CsvFile | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [name, setName] = useState("");
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof previewCsv> | null>(
    null,
  );
  const [validOnly, setValidOnly] = useState(false);
  const [done, setDone] = useState(false);
  const [importId, setImportId] = useState("");
  function map<K extends keyof CsvMapping>(key: K, value: CsvMapping[K]) {
    setMapping((m) => (m ? { ...m, [key]: value } : null));
    setPreview(null);
    setValidOnly(false);
  }
  async function choose(selected: File) {
    try {
      setError("");
      if (selected.size > 10 * 1024 * 1024)
        throw new Error("O arquivo deve ter até 10 MB.");
      const text = await selected.text();
      const data = readCsv(text);
      if (!data.fields.length || !data.rows.length)
        throw new Error("Não encontramos linhas com cabeçalho nesse CSV.");
      const h = await fileHash(text);
      if (workspace.imports.some((b) => b.hash === h))
        throw new Error(
          "Este arquivo já foi importado. Nenhum movimento foi duplicado.",
        );
      setFile(data);
      setMapping(suggestMapping(data.fields));
      setName(selected.name);
      setHash(h);
      setImportId(crypto.randomUUID());
      setDone(false);
      setPreview(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível ler o arquivo.",
      );
    }
  }
  if (done)
    return (
      <div className="import-success">
        <CheckCircle2 size={44} />
        <h3>Extrato importado</h3>
        <p>
          Os movimentos estão disponíveis. Vá para Descoberta para revisar
          possíveis assinaturas.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setFile(null);
            setDone(false);
          }}
        >
          Importar outro arquivo
        </Button>
      </div>
    );
  return (
    <div className="import-panel">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f);
          e.target.value = "";
        }}
      />
      {!file ? (
        <>
          <button
            className="upload-zone"
            onClick={() => input.current?.click()}
          >
            <FileUp size={30} />
            <strong>Escolha seu extrato CSV</strong>
            <span>Até 10 MB · até 20 mil linhas</span>
            <span className="upload-link">
              Selecionar arquivo <ArrowRight size={15} />
            </span>
          </button>
          <p className="field-help">
            O arquivo deve ter um cabeçalho, data, descrição e valor. Você
            poderá conferir tudo antes de importar. O arquivo original não será
            armazenado.
          </p>
        </>
      ) : (
        <>
          <div className="file-summary">
            <FileSpreadsheet size={24} />
            <div>
              <strong>{name}</strong>
              <span>{file.rows.length} linhas encontradas</span>
            </div>
            <Button variant="ghost" onClick={() => input.current?.click()}>
              Trocar
            </Button>
          </div>
          <div className="form-grid">
            {(
              [
                ["date", "Data"],
                ["description", "Descrição"],
                ["amount", "Valor"],
                ["currency", "Moeda (opcional)"],
                ["id", "ID do movimento (opcional)"],
              ] as const
            ).map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <select
                  value={mapping?.[key] ?? ""}
                  onChange={(e) => map(key, e.target.value)}
                >
                  <option value="">Selecionar...</option>
                  {file.fields.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="field">
            Conta ou cartão de origem
            <input
              value={mapping?.account ?? ""}
              maxLength={100}
              onChange={(e) => map("account", e.target.value)}
            />
            <span className="field-help">
              Use sempre o mesmo nome para a mesma conta, inclusive em arquivos
              sobrepostos.
            </span>
          </label>
          <div className="form-grid">
            <label className="field">
              Formato da data
              <select
                value={mapping?.dateFormat}
                onChange={(e) =>
                  map("dateFormat", e.target.value as "dmy" | "mdy")
                }
              >
                <option value="dmy">Dia / mês / ano</option>
                <option value="mdy">Mês / dia / ano</option>
              </select>
            </label>
            <label className="field">
              Saídas no arquivo
              <select
                value={mapping?.debitSign}
                onChange={(e) =>
                  map("debitSign", e.target.value as "negative" | "positive")
                }
              >
                <option value="negative">Valores negativos</option>
                <option value="positive">Valores positivos</option>
              </select>
            </label>
          </div>
          {!mapping?.currency && (
            <label className="field">
              Moeda dos movimentos
              <select
                value={mapping?.defaultCurrency}
                onChange={(e) =>
                  map("defaultCurrency", e.target.value as "BRL" | "USD")
                }
              >
                <option value="BRL">BRL · Real</option>
                <option value="USD">USD · Dólar</option>
              </select>
            </label>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              try {
                setError("");
                if (mapping)
                  setPreview(previewCsv(file, mapping, workspace, importId));
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Confira as colunas.",
                );
              }
            }}
          >
            Conferir prévia <ArrowRight size={16} />
          </Button>
          {preview && (
            <div className="import-preview">
              <h3>{preview.rows.length} novos movimentos</h3>
              <p>
                {preview.duplicates} já existentes · {preview.errors.length}{" "}
                erros
              </p>
              <div className="preview-table">
                {preview.rows.slice(0, 5).map((row) => (
                  <div key={row.id}>
                    <span>
                      {row.date}
                      <strong>{row.description}</strong>
                    </span>
                    <span>
                      {row.direction === "credit" ? "+" : "−"}{" "}
                      {money(row.amount, row.currency)}
                    </span>
                  </div>
                ))}
              </div>
              {preview.errors.length > 0 && (
                <>
                  <div className="import-errors" role="status">
                    {preview.errors.slice(0, 8).map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={validOnly}
                      onChange={(e) => setValidOnly(e.target.checked)}
                    />
                    Importar somente as linhas válidas listadas
                  </label>
                </>
              )}
              <p className="field-help">
                Sem um ID do emissor, descrições iguais podem ser ambíguas.
                Confira a prévia. Parcelas, estornos, transferências e pagamento
                de fatura recebem classificação separada.
              </p>
              <Button
                busy={busy}
                disabled={
                  !preview.rows.length ||
                  (preview.errors.length > 0 && !validOnly)
                }
                onClick={async () => {
                  const next = {
                    ...workspace,
                    transactions: [...workspace.transactions, ...preview.rows],
                    imports: [
                      ...workspace.imports,
                      {
                        id: importId,
                        name,
                        hash,
                        count: preview.rows.length,
                        createdAt: new Date().toISOString(),
                        source: "csv" as const,
                      },
                    ],
                  };
                  if (
                    await onCommit(
                      next,
                      `${preview.rows.length} movimentos importados`,
                    )
                  )
                    setDone(true);
                }}
              >
                Importar {preview.rows.length} movimentos
              </Button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
