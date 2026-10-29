"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  LockKeyhole,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { Workspace } from "@/domain/model";
import { Button } from "./ui";
import { useCsvImport } from "./imports/use-csv-import";
import { MappingFields } from "./imports/mapping-fields";
import { ImportReview } from "./imports/import-review";
import {
  compareStatementPeriods,
  monthLabel,
} from "@/domain/discovery/periods";

export function ImportPanel({
  workspace,
  onCommit,
  busy,
  onDiscover,
  onMovements,
}: {
  workspace: Workspace;
  onCommit: (next: Workspace, message: string) => Promise<boolean>;
  busy: boolean;
  onDiscover?: () => void;
  onMovements?: () => void;
}) {
  const flow = useCsvImport(workspace, onCommit);
  const input = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    scroll = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const disabled = busy || flow.saving;
  const step = flow.phase === "file" ? 0 : flow.phase === "mapping" ? 1 : 2;
  const comparison =
    flow.mapping && flow.preview
      ? compareStatementPeriods(
          workspace.transactions,
          flow.preview.rows,
          flow.mapping.account.trim(),
        )
      : null;
  useEffect(() => {
    if (flow.phase !== "file") heading.current?.focus();
    scroll.current?.scrollTo({ top: 0 });
  }, [flow.phase]);
  return (
    <div className="csv-import-flow">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Selecionar extrato CSV"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void flow.choose(f);
          e.target.value = "";
        }}
      />
      {flow.phase !== "done" && (
        <ol className="import-steps" aria-label="Etapas da importação">
          {["Arquivo", "Leitura", "Conferência"].map((label, i) => (
            <li
              key={label}
              className={step >= i ? "is-current" : ""}
              aria-current={step === i ? "step" : undefined}
            >
              <span>{step > i ? <Check size={12} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className="import-scroll" ref={scroll}>
        {flow.phase === "file" && (
          <div className="import-upload">
            <h2 ref={heading} tabIndex={-1}>
              Seu extrato, sem trabalho extra.
            </h2>
            <p>
              Traga o CSV da sua conta Inter. Você confere os movimentos antes
              de salvar qualquer coisa.
            </p>
            <button
              type="button"
              className={`import-dropzone ${dragging ? "is-dragging" : ""}`}
              disabled={flow.reading || disabled}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!flow.reading) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (disabled || flow.reading) return;
                if (e.dataTransfer.files.length > 1)
                  flow.reject(
                    "Envie um arquivo por vez para conferir cada extrato.",
                  );
                else if (e.dataTransfer.files.length === 1)
                  void flow.choose(e.dataTransfer.files[0]);
              }}
            >
              {flow.reading ? (
                <LoaderCircle size={30} className="spin" />
              ) : (
                <FileUp size={30} />
              )}
              <strong>
                {flow.reading ? "Lendo seu extrato…" : "Solte o CSV aqui"}
              </strong>
              <span>
                {flow.reading
                  ? "Identificando colunas e verificando o arquivo"
                  : "ou clique para selecionar um arquivo"}
              </span>
              <small>CSV · até 10 MB · 20 mil linhas</small>
            </button>
            <div className="import-privacy-note">
              <LockKeyhole size={15} />
              <span>
                A leitura acontece neste navegador. Somente os movimentos que
                você confirmar serão salvos.
              </span>
            </div>
            <details className="import-help">
              <summary>Qual arquivo devo escolher?</summary>
              <p>
                Use o extrato da conta com data, descrição e valor de cada
                movimento. Um PDF de comprovante ou uma planilha renomeada para
                .csv não funciona. Cabeçalhos e separadores variam; você poderá
                ajustar a leitura.
              </p>
            </details>
          </div>
        )}
        {flow.document && flow.phase !== "done" && (
          <>
            <div className="import-file-strip">
              <FileSpreadsheet size={21} />
              <div>
                <strong>{flow.document.name}</strong>
                <span>
                  {flow.document.profile} · {flow.document.encoding}
                </span>
              </div>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => input.current?.click()}
              >
                <RefreshCw size={14} />
                Trocar
              </Button>
            </div>
            {flow.phase === "mapping" && flow.mapping && (
              <>
                <div className="import-title">
                  <h2 ref={heading} tabIndex={-1}>
                    Confira a leitura.
                  </h2>
                  <p>
                    Identifique a conta e veja se datas, descrições e sinais
                    fazem sentido.
                  </p>
                </div>
                {flow.document.file.preambleLines > 0 && (
                  <p className="import-format-note">
                    Cabeçalho encontrado na linha{" "}
                    {flow.document.file.headerLine}. Informações anteriores à
                    tabela foram deixadas de fora.
                  </p>
                )}
                <MappingFields
                  file={flow.document.file}
                  mapping={flow.mapping}
                  change={flow.change}
                  accounts={[
                    ...new Set(workspace.transactions.map((t) => t.account)),
                  ]}
                  preview={flow.preview}
                  problem={flow.problem}
                />
                {comparison && comparison.incomingMonths.length > 0 && (
                  <p className="import-format-note" role="status">
                    Meses detectados pelas datas:{" "}
                    {comparison.incomingMonths
                      .map((m) => monthLabel(m.month))
                      .join(", ")}
                    .
                    {comparison.priorMonths > 0
                      ? ` Este extrato será comparado com o histórico desta conta (${comparison.priorMonths} ${comparison.priorMonths === 1 ? "mês" : "meses"}); ${comparison.newMonths.length} ${comparison.newMonths.length === 1 ? "mês novo será acrescentado" : "meses novos serão acrescentados"}.`
                      : " Os próximos extratos desta mesma conta serão comparados automaticamente."}{" "}
                    Os nomes dos arquivos não definem o período.
                  </p>
                )}
              </>
            )}
            {flow.phase === "review" && flow.preview && (
              <>
                <div className="import-title">
                  <h2 ref={heading} tabIndex={-1}>
                    Tudo no lugar?
                  </h2>
                  <p>
                    {flow.preview.rows.length} novos · {flow.preview.duplicates}{" "}
                    já existentes · {flow.preview.invalid} com erro ·{" "}
                    {flow.preview.ignored + flow.preview.excluded} fora do lote
                  </p>
                  {flow.preview.period && (
                    <span>
                      {flow.preview.period.from.split("-").reverse().join("/")}{" "}
                      a {flow.preview.period.to.split("-").reverse().join("/")}{" "}
                      · {flow.mapping?.account}
                    </span>
                  )}
                </div>
                <ImportReview
                  preview={flow.preview}
                  toggle={flow.toggle}
                  disabled={disabled}
                />
                {flow.preview.invalid > 0 && !flow.preview.blocking && (
                  <label className="import-partial">
                    <input
                      type="checkbox"
                      checked={flow.allowPartial}
                      disabled={disabled}
                      onChange={(e) => flow.setAllowPartial(e.target.checked)}
                    />
                    <span>
                      Importar somente as {flow.preview.rows.length} linhas
                      válidas selecionadas. As {flow.preview.invalid} linhas com
                      erro não serão salvas.
                    </span>
                  </label>
                )}
              </>
            )}
          </>
        )}
        {flow.phase === "done" && (
          <div className="import-complete">
            <CheckCircle2 size={40} />
            <h2 ref={heading} tabIndex={-1}>
              Extrato importado
            </h2>
            <p>
              {flow.savedCount} movimentos salvos. Agora você pode revisar
              possíveis assinaturas na Descoberta. A análise cruza
              automaticamente este extrato com os outros períodos da mesma
              conta.
            </p>
            <div>
              <Button onClick={onDiscover}>
                Revisar assinaturas
                <ArrowRight size={16} />
              </Button>
              <Button variant="secondary" onClick={onMovements}>
                Ver movimentos
              </Button>
            </div>
            <button
              type="button"
              className="import-text-action"
              onClick={flow.reset}
            >
              Importar outro arquivo
            </button>
          </div>
        )}
      </div>
      {flow.error && (
        <p className="form-error import-error" role="alert">
          {flow.error}
        </p>
      )}
      {flow.phase !== "done" && (
        <footer className="import-actionbar">
          <div className="import-action-context">
            {flow.phase === "file" ? (
              <>
                <LockKeyhole size={15} />
                <span>Seu arquivo original não é armazenado.</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>
                  {flow.phase === "mapping"
                    ? "Nada foi salvo ainda."
                    : `${flow.preview?.rows.length ?? 0} movimentos selecionados`}
                </span>
              </>
            )}
          </div>
          {flow.phase === "mapping" && (
            <Button disabled={disabled} onClick={flow.review}>
              Conferir prévia
              <ArrowRight size={16} />
            </Button>
          )}
          {flow.phase === "review" && (
            <div className="import-action-buttons">
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => flow.setPhase("mapping")}
              >
                <ArrowLeft size={15} />
                Ajustar
              </Button>
              <Button
                busy={disabled}
                disabled={
                  !flow.preview?.rows.length ||
                  flow.preview.blocking ||
                  (flow.preview.invalid > 0 && !flow.allowPartial)
                }
                onClick={() => void flow.commit()}
              >
                Importar {flow.preview?.rows.length ?? 0} movimentos
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
