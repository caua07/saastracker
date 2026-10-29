"use client";
import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { services } from "@/domain/catalog";
import {
  CATEGORIES,
  subscriptionSchema,
  type Subscription,
  type Currency,
  type Cycle,
} from "@/domain/model";
import { today, cycleLabels, dateLabel } from "@/domain/finance";
import {
  nextScheduledDate,
  nextUnobservedDate,
} from "@/domain/discovery/schedule";
import { parseAmount } from "@/domain/imports/values";
import type { Candidate } from "@/domain/recurrence";
import { ServiceLogo } from "./brand";
import { Button } from "./ui";

export function SubscriptionForm({
  initial,
  candidate,
  onSave,
  onCancel,
  busy,
}: {
  initial?: Subscription;
  candidate?: Candidate;
  onSave: (value: Subscription) => Promise<boolean>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [service, setService] = useState(
    initial?.service ?? candidate?.service ?? "",
  );
  const [name, setName] = useState(initial?.name ?? candidate?.name ?? "");
  const [amount, setAmount] = useState(
    initial?.amount ?? candidate?.amount ?? "",
  );
  const [currency, setCurrency] = useState<Currency>(
    initial?.currency ?? candidate?.currency ?? "BRL",
  );
  const [cycle, setCycle] = useState<Cycle | "">(
    initial?.cycle ?? candidate?.cycle ?? (candidate ? "" : "monthly"),
  );
  const [category, setCategory] = useState(
    initial?.category ?? candidate?.category ?? "Outros",
  );
  const [anchorDate, setAnchorDate] = useState(
    initial?.anchorDate ??
      candidate?.schedule?.anchorDate ??
      (candidate ? "" : today()),
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [status, setStatus] = useState<Subscription["status"]>(
    initial?.status ?? "active",
  );
  const [cancelDate, setCancelDate] = useState(initial?.cancelDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [error, setError] = useState("");
  function selectService(id: string) {
    setService(id);
    const entry = services.find((s) => s.id === id);
    if (entry) {
      setName(entry.name);
      setCategory(entry.category);
      setWebsite(`https://${entry.domain}`);
    }
  }
  return (
    <form
      className="subscription-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        let parsedAmount: string;
        try {
          parsedAmount = parseAmount(amount).toFixed();
          if (Number(parsedAmount) < 0) throw new Error();
        } catch {
          setError("Informe um valor positivo, como 29,90.");
          return;
        }
        if (!cycle) {
          setError("Confirme a frequência do plano antes de salvar.");
          return;
        }
        const now = new Date().toISOString();
        const term = {
          effectiveFrom: initial ? today() : startDate,
          amount: parsedAmount,
          currency,
          cycle,
        };
        let history = initial?.history ?? [];
        if (
          !initial ||
          initial.amount !== parsedAmount ||
          initial.currency !== currency ||
          initial.cycle !== cycle
        )
          history = [
            ...history.filter((t) => t.effectiveFrom !== term.effectiveFrom),
            term,
          ];
        const parsed = subscriptionSchema.safeParse({
          id: initial?.id ?? crypto.randomUUID(),
          service,
          name,
          amount: parsedAmount,
          currency,
          cycle,
          category,
          status,
          anchorDate,
          startDate,
          cancelDate: cancelDate || null,
          website,
          notes,
          history,
          createdAt: initial?.createdAt ?? now,
          updatedAt: now,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Confira os campos.");
          return;
        }
        await onSave(parsed.data);
      }}
    >
      <div className="service-preview">
        <ServiceLogo service={service} name={name || "SA"} size={56} />
        <div>
          <strong>{name || "Sua próxima assinatura"}</strong>
          <span>
            {service ? "Serviço do catálogo" : "Personalize os detalhes abaixo"}
          </span>
        </div>
      </div>
      <label className="field">
        Serviço
        <select value={service} onChange={(e) => selectService(e.target.value)}>
          <option value="">Outro serviço</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="field-help">
          O catálogo sugere nome e categoria. Você informa o preço.
        </span>
      </label>
      <label className="field">
        Nome
        <input
          required
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Figma Professional"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Valor
          <input
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field">
          Moeda
          <select
            aria-label="Moeda"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            <option value="BRL">BRL · Real</option>
            <option value="USD">USD · Dólar</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          Frequência
          <select
            required
            value={cycle}
            onChange={(e) => setCycle(e.target.value as Cycle)}
          >
            <option value="" disabled>
              Confira a frequência do plano
            </option>
            {Object.entries(cycleLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {candidate?.schedule
            ? "Data-base observada"
            : initial
              ? "Data-base da cobrança"
              : "Próxima cobrança"}
          <input
            required
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
          />
        </label>
      </div>
      {(candidate?.schedule || initial) && cycle && anchorDate && (
        <p className="field-help">
          {candidate?.schedule
            ? "Data-base trazida do extrato"
            : "Data-base do calendário"}
          , usada para preservar o dia do ciclo inclusive em meses curtos.
          Próxima cobrança estimada:{" "}
          {dateLabel(
            candidate?.schedule &&
              anchorDate === candidate.schedule.anchorDate &&
              cycle === candidate.cycle
              ? nextUnobservedDate(candidate.schedule, cycle, today())
              : nextScheduledDate(anchorDate, cycle, today()),
            true,
          )}
          .
          {candidate?.schedule &&
            " Confira o contrato antes de confirmar; a data de início não é inferida do extrato."}
        </p>
      )}
      <label className="field">
        Categoria
        <input
          required
          maxLength={60}
          list="subscription-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="subscription-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <details className="advanced-fields">
        <summary>
          Mais detalhes <ChevronDown size={16} />
        </summary>
        <div>
          <div className="form-grid">
            <label className="field">
              Status
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Subscription["status"])
                }
              >
                <option value="active">Ativa</option>
                <option value="trial">Em trial</option>
                <option value="paused">Pausada</option>
                <option value="canceled">Cancelada</option>
                <option value="archived">Arquivada</option>
              </select>
            </label>
            <label className="field">
              Início
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            Término agendado (opcional)
            <input
              type="date"
              min={startDate}
              value={cancelDate}
              onChange={(e) => setCancelDate(e.target.value)}
            />
            <span className="field-help">
              A previsão para nesta data. Isso não cancela o serviço no
              fornecedor.
            </span>
          </label>
          <label className="field">
            Site de gerenciamento
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="field">
            Notas
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Plano, conta utilizada ou observações..."
            />
          </label>
        </div>
      </details>
      {candidate && (
        <p className="notice">
          Você está confirmando uma sugestão. Confira valor, ciclo e{" "}
          {candidate.schedule ? "data-base" : "próxima cobrança"} antes de
          salvar.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer className="form-footer">
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Voltar
        </Button>
        <Button type="submit" busy={busy}>
          {initial
            ? "Salvar alterações"
            : candidate
              ? "Confirmar assinatura"
              : "Adicionar assinatura"}
          <ArrowUpRight size={16} />
        </Button>
      </footer>
    </form>
  );
}
