"use client";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import Papa from "papaparse";
import type { CsvEntry, CsvPreview } from "@/domain/imports/types";
import { money } from "@/domain/finance";
import { transactionKindLabels } from "@/domain/transactions";
import { IconButton } from "../ui";

const statuses: Record<CsvEntry["status"], string> = {
  ready: "Novo",
  duplicate: "Já existente",
  invalid: "Revisar",
  ignored: "Ignorado",
  excluded: "Retirado",
};
const size = 50;
export function ImportReview({
  preview,
  toggle,
  disabled,
}: {
  preview: CsvPreview;
  toggle: (line: number) => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      preview.entries.filter(
        (e) =>
          (filter === "all" || e.status === filter) &&
          `${e.description} ${e.line} ${e.message}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [preview.entries, filter, query],
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / size) - 1),
  );
  const start = currentPage * size;
  function downloadIssues() {
    const text = Papa.unparse(
      {
        fields: ["Linha", "Motivo"],
        data: preview.issues.map((i) => [i.line ?? "", i.message]),
      },
      { delimiter: ";", escapeFormulae: true },
    );
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "revisao-extrato.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="import-totals">
        {preview.totals.map((sum) => (
          <dl key={sum.currency}>
            <div>
              <dt>
                <ArrowUpRight size={16} />
                Saídas · {sum.currency}
              </dt>
              <dd>{money(sum.debit, sum.currency)}</dd>
            </div>
            <div>
              <dt>
                <ArrowDownLeft size={16} />
                Entradas · {sum.currency}
              </dt>
              <dd>{money(sum.credit, sum.currency)}</dd>
            </div>
          </dl>
        ))}
      </div>
      {!preview.rows.length && (
        <p className="import-notice">
          {preview.duplicates && !preview.invalid
            ? "Todos os movimentos reconhecidos já estão registrados nesta conta. Nada será duplicado."
            : "Não há movimentos novos prontos para importar. Revise os ajustes ou escolha outro arquivo."}
        </p>
      )}
      {preview.issues.length > 0 && (
        <div className="import-notice import-notice-warning" role="status">
          <AlertCircle size={18} />
          <div>
            <strong>
              {preview.blocking
                ? "A estrutura do arquivo precisa de correção"
                : `${preview.invalid} ${preview.invalid === 1 ? "linha precisa" : "linhas precisam"} de revisão`}
            </strong>
            <p>
              {preview.blocking
                ? "Há aspas ou estrutura inválida. Corrija o CSV; a importação está bloqueada."
                : "As linhas com erro ficam de fora. Você pode corrigir o arquivo ou confirmar apenas os movimentos válidos."}
            </p>
            <button type="button" onClick={downloadIssues}>
              <Download size={14} /> Baixar relatório de erros
            </button>
          </div>
        </div>
      )}
      <div className="import-review-toolbar">
        <label className="import-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar no extrato"
            aria-label="Buscar no extrato"
          />
        </label>
        <label className="import-filter">
          <span className="sr-only">Filtrar movimentos da prévia</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos · {preview.entries.length}</option>
            {(Object.keys(statuses) as CsvEntry["status"][]).map((s) => (
              <option value={s} key={s}>
                {statuses[s]} ·{" "}
                {preview.entries.filter((e) => e.status === s).length}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="import-ledger"
        role="region"
        aria-label="Movimentos do arquivo"
      >
        <div className="import-ledger-head" aria-hidden="true">
          <span>Incluir</span>
          <span>Movimento / linha no arquivo</span>
          <span>Valor</span>
          <span>Leitura</span>
        </div>
        {filtered.slice(start, start + size).map((entry) => (
          <div
            className={`import-ledger-row import-row-${entry.status}`}
            key={entry.line}
          >
            <div>
              {["ready", "excluded"].includes(entry.status) ? (
                <input
                  type="checkbox"
                  checked={entry.status === "ready"}
                  onChange={() => toggle(entry.line)}
                  aria-label={`Incluir linha ${entry.line}`}
                  disabled={disabled}
                />
              ) : (
                <span className="import-line-number">{entry.line}</span>
              )}
            </div>
            <div className="import-ledger-description">
              <strong>{entry.description}</strong>
              <small>
                {entry.transaction
                  ? `${entry.transaction.date.split("-").reverse().join("/")} · `
                  : ""}
                Linha {entry.line}
                {entry.transaction
                  ? ` · ${transactionKindLabels[entry.transaction.kind]}`
                  : ""}
              </small>
              {entry.status !== "ready" && <p>{entry.message}</p>}
            </div>
            <strong className="import-ledger-amount">
              {entry.transaction
                ? `${entry.transaction.direction === "debit" ? "−" : "+"} ${money(entry.transaction.amount, entry.transaction.currency)}`
                : "Não lido"}
            </strong>
            <span className={`import-row-status status-${entry.status}`}>
              {statuses[entry.status]}
            </span>
          </div>
        ))}
        {!filtered.length && (
          <p className="import-empty-results">
            Nenhum movimento neste filtro. Tente outra busca ou mostre todos.
          </p>
        )}
      </div>
      <div className="import-pagination">
        <span>
          {filtered.length
            ? `${start + 1}–${Math.min(start + size, filtered.length)} de ${filtered.length}`
            : "0 movimentos"}
        </span>
        <div>
          <IconButton
            label="Página anterior"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <span>
            Página {currentPage + 1} de{" "}
            {Math.max(1, Math.ceil(filtered.length / size))}
          </span>
          <IconButton
            label="Próxima página"
            disabled={start + size >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={17} />
          </IconButton>
        </div>
      </div>
      {preview.warnings.map((w) => (
        <p key={w} className="import-muted">
          {w}
        </p>
      ))}
      {preview.invalid > 0 && !preview.blocking && (
        <p className="import-muted">
          Abra o filtro “Revisar” para ver o motivo de cada linha. O relatório
          contém números de linha e instruções de correção.
        </p>
      )}
    </>
  );
}
