"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Workspace } from "@/domain/model";
import { readCsv } from "@/domain/imports/csv";
import { csvProfile } from "@/domain/imports/profiles";
import { previewCsv } from "@/domain/imports/preview";
import { readCsvUpload } from "@/domain/imports/file";
import { prepareCsvImport } from "@/domain/imports/commit";
import type { CsvFile, CsvMapping } from "@/domain/imports/types";

type Document = {
  file: CsvFile;
  name: string;
  hash: string;
  id: string;
  encoding: string;
  profile: string;
};
export function useCsvImport(
  workspace: Workspace,
  onCommit: (next: Workspace, message: string) => Promise<boolean>,
) {
  const [document, setDocument] = useState<Document | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [phase, setPhase] = useState<"file" | "mapping" | "review" | "done">(
    "file",
  );
  const [reading, setReading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [allowPartial, setAllowPartial] = useState(false),
    [excluded, setExcluded] = useState(new Set<number>());
  const [savedCount, setSavedCount] = useState(0);
  const sequence = useRef(0),
    committing = useRef(false);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  function reset() {
    sequence.current++;
    setDocument(null);
    setMapping(null);
    setPhase("file");
    setError("");
    setReading(false);
    setAllowPartial(false);
    setExcluded(new Set());
  }
  async function choose(file: File) {
    const current = ++sequence.current;
    setDocument(null);
    setMapping(null);
    setError("");
    setPhase("file");
    setReading(true);
    setExcluded(new Set());
    setAllowPartial(false);
    try {
      const upload = await readCsvUpload(file);
      if (current !== sequence.current) return;
      // Give the browser a frame to display the reading state before synchronous parsing.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (current !== sequence.current) return;
      const fileData = readCsv(upload.text),
        profile = csvProfile(fileData.fields);
      setDocument({
        file: fileData,
        name: upload.name,
        hash: upload.hash,
        encoding: upload.encoding,
        id: crypto.randomUUID(),
        profile: profile.label,
      });
      setMapping({
        ...profile.mapping,
        account: profile.recognized ? "Inter · Conta" : "Conta principal",
      });
      setPhase("mapping");
    } catch (e) {
      if (current === sequence.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível ler o arquivo. Tente exportá-lo novamente.",
        );
    } finally {
      if (current === sequence.current) setReading(false);
    }
  }
  function change<K extends keyof CsvMapping>(key: K, value: CsvMapping[K]) {
    setMapping((m) => (m ? { ...m, [key]: value } : m));
    setError("");
    setAllowPartial(false);
    setExcluded(new Set());
  }
  const result = useMemo(() => {
    if (!document || !mapping) return { preview: null, problem: "" };
    try {
      return {
        preview: previewCsv(
          document.file,
          mapping,
          workspace,
          document.id,
          excluded,
        ),
        problem: "",
      };
    } catch (e) {
      return {
        preview: null,
        problem: e instanceof Error ? e.message : "Confira as colunas.",
      };
    }
  }, [document, mapping, workspace, excluded]);
  function review() {
    if (!result.preview) {
      setError(result.problem);
      return;
    }
    setError("");
    setPhase("review");
  }
  function toggle(line: number) {
    setExcluded((old) => {
      const next = new Set(old);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }
  async function commit() {
    if (!document || !mapping || committing.current) return;
    committing.current = true;
    setSaving(true);
    setError("");
    try {
      const prepared = prepareCsvImport(
        document.file,
        mapping,
        workspace,
        { id: document.id, name: document.name, hash: document.hash },
        { allowPartial, excluded },
      );
      if (
        await onCommit(
          prepared.workspace,
          `${prepared.preview.rows.length} movimentos importados`,
        )
      ) {
        setSavedCount(prepared.preview.rows.length);
        setPhase("done");
      } else
        setError(
          "Não foi possível salvar. Sua revisão foi mantida. Confira o aviso e tente novamente.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar o extrato.",
      );
    } finally {
      committing.current = false;
      setSaving(false);
    }
  }
  return {
    document,
    mapping,
    phase,
    setPhase,
    reading,
    saving,
    error,
    allowPartial,
    setAllowPartial,
    savedCount,
    choose,
    reset,
    change,
    review,
    toggle,
    commit,
    reject: setError,
    ...result,
  };
}
