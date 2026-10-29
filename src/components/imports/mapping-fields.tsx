"use client";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { CsvFile, CsvMapping } from "@/domain/imports/types";
import { transactionKindLabels } from "@/domain/transactions";
import type { CsvPreview } from "@/domain/imports/types";
import { money } from "@/domain/finance";

export function MappingFields({
  file,
  mapping,
  change,
  accounts,
  preview,
  problem,
}: {
  file: CsvFile;
  mapping: CsvMapping;
  change: <K extends keyof CsvMapping>(key: K, value: CsvMapping[K]) => void;
  accounts: string[];
  preview: CsvPreview | null;
  problem: string;
}) {
  const [advanced, setAdvanced] = useState(
    !mapping.date ||
      !mapping.description ||
      (!mapping.amount && !mapping.debit),
  );
  const select = (
    key:
      | "date"
      | "description"
      | "details"
      | "amount"
      | "debit"
      | "credit"
      | "currency"
      | "id",
    label: string,
    optional = false,
  ) => (
    <label className="field" key={key}>
      {label}
      <select
        value={mapping[key]}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">{optional ? "Não usar" : "Selecionar coluna"}</option>
        {file.fields.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <label className="field import-account">
        Conta de origem
        <input
          value={mapping.account}
          onChange={(e) => change("account", e.target.value)}
          maxLength={100}
          list="import-accounts"
          autoComplete="off"
        />
        <datalist id="import-accounts">
          {accounts.map((a) => (
            <option value={a} key={a} />
          ))}
        </datalist>
        <span className="field-help">
          Use o mesmo nome em todos os extratos desta conta para reconhecer
          movimentos já importados.
        </span>
      </label>
      <button
        type="button"
        className="import-settings-toggle"
        aria-expanded={advanced}
        aria-controls="csv-settings"
        onClick={() => setAdvanced(!advanced)}
      >
        <SlidersHorizontal size={16} /> Ajustar leitura{" "}
        <span>{advanced ? "Recolher" : "Colunas, datas e valores"}</span>
        <ChevronDown size={15} />
      </button>
      {advanced && (
        <div id="csv-settings" className="import-settings">
          <div className="import-field-grid">
            {select("date", "Coluna de data")}
            {select("description", "Coluna de descrição")}
            {select("details", "Complemento da descrição", true)}
          </div>
          <label className="field">
            Como os valores estão organizados
            <select
              value={mapping.amount ? "amount" : "split"}
              onChange={(e) => {
                change(
                  "amount",
                  e.target.value === "amount"
                    ? (file.fields.find((f) => /valor|amount/i.test(f)) ??
                        file.fields[0])
                    : "",
                );
              }}
            >
              <option value="amount">Uma coluna de valor</option>
              <option value="split">Colunas de débito e crédito</option>
            </select>
          </label>
          <div className="import-field-grid">
            {mapping.amount ? (
              select("amount", "Coluna de valor")
            ) : (
              <>
                {select("debit", "Coluna de débito")}
                {select("credit", "Coluna de crédito")}
              </>
            )}
            <label className="field">
              Formato dos números
              <select
                value={mapping.numberFormat}
                onChange={(e) =>
                  change(
                    "numberFormat",
                    e.target.value as CsvMapping["numberFormat"],
                  )
                }
              >
                <option value="auto">
                  Automático · sem adivinhar ambiguidades
                </option>
                <option value="br">Brasileiro · 1.234,56</option>
                <option value="us">Americano · 1,234.56</option>
              </select>
            </label>
            {mapping.amount && (
              <label className="field">
                Saídas no arquivo
                <select
                  value={mapping.debitSign}
                  onChange={(e) =>
                    change(
                      "debitSign",
                      e.target.value as CsvMapping["debitSign"],
                    )
                  }
                >
                  <option value="negative">
                    Valores negativos · extrato da conta
                  </option>
                  <option value="positive">
                    Valores positivos · confira a origem
                  </option>
                </select>
              </label>
            )}
            <label className="field">
              Formato da data
              <select
                value={mapping.dateFormat}
                onChange={(e) =>
                  change(
                    "dateFormat",
                    e.target.value as CsvMapping["dateFormat"],
                  )
                }
              >
                <option value="dmy">Dia / mês / ano</option>
                <option value="mdy">Mês / dia / ano</option>
              </select>
            </label>
            {select("currency", "Coluna de moeda", true)}
            {!mapping.currency && (
              <label className="field">
                Moeda dos movimentos
                <select
                  value={mapping.defaultCurrency}
                  onChange={(e) =>
                    change(
                      "defaultCurrency",
                      e.target.value as CsvMapping["defaultCurrency"],
                    )
                  }
                >
                  <option value="BRL">BRL · Real</option>
                  <option value="USD">USD · Dólar</option>
                </select>
              </label>
            )}
            {select("id", "ID bancário (opcional)", true)}
          </div>
        </div>
      )}
      <section className="import-sample" aria-labelledby="sample-title">
        <div className="import-section-heading">
          <h3 id="sample-title">É assim que vamos ler</h3>
          <span>Primeiros movimentos válidos</span>
        </div>
        {preview?.entries
          .filter((e) => e.transaction)
          .slice(0, 3)
          .map((entry) => {
            const t = entry.transaction!;
            return (
              <div className="import-sample-row" key={entry.line}>
                <span>{t.date.split("-").reverse().join("/")}</span>
                <div>
                  <strong>{t.description}</strong>
                  <small>{transactionKindLabels[t.kind]}</small>
                </div>
                <strong>
                  {t.direction === "debit" ? "−" : "+"}{" "}
                  {money(t.amount, t.currency)}
                </strong>
              </div>
            );
          })}
        {(!preview || !preview.entries.some((e) => e.transaction)) && (
          <p className="import-muted">
            {problem ||
              "Nenhum movimento válido ainda. Confira os ajustes e os valores do arquivo."}
          </p>
        )}
      </section>
      <p className="import-muted">
        Saldo não vira movimentação. Entradas e saídas mantêm o sinal do
        extrato; a confirmação vem na próxima etapa.
      </p>
    </>
  );
}
