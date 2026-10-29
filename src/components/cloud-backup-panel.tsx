"use client";
import { useState } from "react";
import { CloudUpload, CloudDownload, Trash2 } from "lucide-react";
import { backupSchema } from "@/domain/model";
import { Button, Confirm } from "./ui";

export function CloudBackupPanel({ busy }: { busy: boolean }) {
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [remove, setRemove] = useState(false);
  async function action(method: "GET" | "POST" | "DELETE") {
    if (working || busy) return;
    setWorking(method);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/backups", { method });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Não foi possível acessar a cópia. Tente novamente.",
        );
      if (method === "GET") {
        const backup = backupSchema.parse(result);
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "saastemics-cloud.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage(
          "Cópia baixada. Use Restaurar backup para recuperar os dados.",
        );
      } else if (method === "POST") {
        setMessage("Cópia salva na nuvem. A cópia anterior foi substituída.");
      } else {
        setMessage(
          "Cópia da nuvem excluída. Seus dados no app foram preservados.",
        );
        setRemove(false);
      }
    } catch (err) {
      if (method === "DELETE") setRemove(false);
      setError(true);
      setMessage(
        err instanceof Error
          ? err.message
          : "Sem conexão com o backup. Tente novamente.",
      );
    } finally {
      setWorking(null);
    }
  }
  return (
    <>
      <div className="settings-divider" />
      <h3>Uma cópia na nuvem</h3>
      <p className="muted">
        Guarde uma cópia privada dos dados já salvos. Cada envio substitui a
        anterior; não há agendamento automático.
      </p>
      <div className="settings-actions">
        <Button
          variant="secondary"
          disabled={busy || !!working}
          busy={working === "POST"}
          onClick={() => void action("POST")}
        >
          <CloudUpload size={16} />
          Salvar na nuvem
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !!working}
          busy={working === "GET"}
          onClick={() => void action("GET")}
        >
          <CloudDownload size={16} />
          Baixar da nuvem
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !!working}
          onClick={() => setRemove(true)}
        >
          <Trash2 size={16} />
          Excluir cópia
        </Button>
      </div>
      <p className="field-help">
        A cópia é independente: excluir os dados do app não apaga este backup.
        Exclua a cópia aqui quando desejar.
      </p>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={error ? "form-error" : "field-help"}
        >
          {message}
        </p>
      )}
      <Confirm
        open={remove}
        onClose={() => setRemove(false)}
        title="Excluir a cópia da nuvem?"
        description="Esta ação apaga o backup armazenado na nuvem. As assinaturas e os movimentos no app continuam disponíveis."
        action="Excluir cópia"
        busy={!!working}
        onConfirm={() => action("DELETE")}
      />
    </>
  );
}
