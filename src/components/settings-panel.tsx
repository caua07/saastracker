"use client";
import { useRef, useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  backupSchema,
  preferencesSchema,
  emptyWorkspace,
  type Workspace,
} from "@/domain/model";
import { subscriptionsCsv } from "@/domain/imports";
import { today } from "@/domain/finance";
import { Button, Confirm } from "./ui";

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SettingsPanel({
  workspace,
  onCommit,
  busy,
  demo,
}: {
  workspace: Workspace;
  onCommit: (
    next: Workspace,
    message: string,
    resetConnections?: boolean,
  ) => Promise<boolean>;
  busy: boolean;
  demo: boolean;
}) {
  const [prefs, setPrefs] = useState(workspace.preferences),
    [error, setError] = useState(""),
    [restore, setRestore] = useState<Workspace | null>(null),
    [remove, setRemove] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="settings-panel">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const parsed = preferencesSchema.safeParse({
            ...prefs,
            usdBrl: prefs.usdBrl.replace(",", "."),
          });
          if (!parsed.success) {
            setError(
              parsed.error.issues[0]?.message ?? "Confira as preferências.",
            );
            return;
          }
          await onCommit(
            { ...workspace, preferences: parsed.data },
            "Preferências salvas",
          );
        }}
      >
        <h3>Do seu jeito</h3>
        <p className="muted">Uma ferramenta pessoal, com os seus números.</p>
        <label className="field">
          Como você quer ser chamado?
          <input
            maxLength={50}
            value={prefs.displayName}
            onChange={(e) =>
              setPrefs({ ...prefs, displayName: e.target.value })
            }
            placeholder="Seu nome"
          />
        </label>
        <label className="field">
          Moeda principal
          <select
            value={prefs.baseCurrency}
            onChange={(e) =>
              setPrefs({
                ...prefs,
                baseCurrency: e.target.value as "BRL" | "USD",
              })
            }
          >
            <option value="BRL">Real brasileiro · BRL</option>
            <option value="USD">Dólar americano · USD</option>
          </select>
        </label>
        <div className="settings-divider" />
        <h3>Câmbio com contexto</h3>
        <p className="muted">
          Informe quantos reais equivalem a US$ 1. A taxa é manual e serve às
          estimativas, não à liquidação do cartão.
        </p>
        <div className="form-grid">
          <label className="field">
            US$ 1 em reais
            <input
              inputMode="decimal"
              placeholder="Ex.: 5,20"
              value={prefs.usdBrl}
              onChange={(e) => setPrefs({ ...prefs, usdBrl: e.target.value })}
            />
          </label>
          <label className="field">
            Data de referência
            <input
              type="date"
              max={today()}
              value={prefs.fxDate ?? ""}
              onChange={(e) =>
                setPrefs({ ...prefs, fxDate: e.target.value || null })
              }
            />
          </label>
        </div>
        <p className="field-help">
          Sem cotação, BRL e USD aparecem separados. Nenhuma moeda é tratada
          como zero.
        </p>
        <label className="field">
          Avisar sobre renovações
          <select
            value={prefs.reminderDays}
            onChange={(e) =>
              setPrefs({ ...prefs, reminderDays: Number(e.target.value) })
            }
          >
            <option value={0}>No dia</option>
            <option value={3}>3 dias antes</option>
            <option value={7}>7 dias antes</option>
            <option value={14}>14 dias antes</option>
            <option value={30}>30 dias antes</option>
          </select>
          <span className="field-help">
            Avisos dentro do aplicativo. Não envia e-mails ou notificações
            quando estiver fechado.
          </span>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={prefs.compact}
            onChange={(e) => setPrefs({ ...prefs, compact: e.target.checked })}
          />
          Lista com densidade compacta
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy}>
          Salvar preferências
        </Button>
      </form>
      <div className="settings-divider" />
      <h3>Seus dados ficam com você</h3>
      <p className="muted">
        Faça uma cópia antes de grandes alterações. O backup JSON permite
        restaurar seu espaço; o CSV é uma lista para consulta.
      </p>
      <div className="settings-actions">
        <Button
          variant="secondary"
          onClick={() =>
            downloadFile(
              `saastemics-${today()}.json`,
              JSON.stringify(
                {
                  format: "saastemics",
                  schemaVersion: 1,
                  exportedAt: new Date().toISOString(),
                  data: workspace,
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          <Download size={16} />
          Backup JSON
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            downloadFile(
              `assinaturas-${today()}.csv`,
              "\uFEFF" + subscriptionsCsv(workspace),
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={16} />
          Exportar CSV
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => file.current?.click()}
        >
          <Upload size={16} />
          Restaurar backup
        </Button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            if (f.size > 10 * 1024 * 1024)
              throw new Error("O backup deve ter até 10 MB.");
            const parsed = backupSchema.safeParse(JSON.parse(await f.text()));
            if (!parsed.success)
              throw new Error(
                "Esse arquivo não é um backup Saastemics válido ou está em outra versão.",
              );
            setRestore(parsed.data.data);
            setError("");
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Não foi possível ler o backup.",
            );
          }
        }}
      />
      <div className="privacy-note">
        <ShieldCheck size={19} />
        <p>
          {demo
            ? "Esta demonstração contém apenas dados fictícios e não acessa seu banco."
            : "Seus dados são privados. A exportação não contém credenciais nem tokens de acesso."}
        </p>
      </div>
      <div className="settings-divider" />
      <h3>Começar de novo</h3>
      <p className="muted">
        Remove assinaturas, movimentos, decisões e preferências. Sua conta de
        acesso é preservada.
      </p>
      <Button variant="danger" onClick={() => setRemove(true)}>
        <Trash2 size={16} />
        Excluir meus dados
      </Button>
      <p className="field-help">
        Excluir dados locais não cancela contratos nos serviços nem revoga
        consentimentos bancários.{" "}
        <a
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noreferrer"
        >
          Gerenciar acesso Google <ExternalLink size={12} />
        </a>
      </p>
      <Confirm
        open={!!restore}
        onClose={() => setRestore(null)}
        title="Restaurar este backup?"
        description={`Seu espaço atual será substituído por ${restore?.subscriptions.length ?? 0} assinaturas e ${restore?.transactions.length ?? 0} movimentos. Conexões pendentes serão interrompidas. Exporte uma cópia atual antes de continuar.`}
        action="Substituir e restaurar"
        busy={busy}
        onConfirm={async () => {
          if (
            restore &&
            (await onCommit(
              { ...restore, version: workspace.version },
              "Backup restaurado",
              true,
            ))
          ) {
            setPrefs(restore.preferences);
            setRestore(null);
          }
        }}
      />
      <Confirm
        open={remove}
        onClose={() => setRemove(false)}
        title="Excluir todos os seus dados?"
        description="Esta ação remove os dados financeiros e interrompe sincronizações pendentes. Ela não cancela assinaturas nos fornecedores. Só será possível recuperar os dados com um backup que você já exportou."
        action="Excluir meus dados"
        busy={busy}
        onConfirm={async () => {
          const next = { ...emptyWorkspace(), version: workspace.version };
          if (await onCommit(next, "Dados excluídos", true)) {
            setPrefs(next.preferences);
            setRemove(false);
          }
        }}
      />
    </div>
  );
}
