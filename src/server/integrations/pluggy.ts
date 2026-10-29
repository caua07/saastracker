import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq, lt, or, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { bankSyncs } from "../db/schema";
import { loadWorkspace, saveWorkspace } from "../workspace";
import { transactionKind } from "@/domain/imports";
import { type Transaction } from "@/domain/model";

export type BankSyncState = {
  accounts: { id: string; label: string; scope: string }[];
  index: number;
  next: string | null;
  rows: Transaction[];
  skipped: number;
  batchId: string;
};
export function pluggyConfigured() {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}
let apiKey: { value: string; until: number } | undefined;
export class BankError extends Error {}
async function key() {
  if (apiKey && apiKey.until > Date.now()) return apiKey.value;
  const response = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new BankError(
      "A autenticação da Pluggy foi recusada. Confira as credenciais no servidor.",
    );
  const result = z.object({ apiKey: z.string() }).parse(await response.json());
  apiKey = { value: result.apiKey, until: Date.now() + 30 * 60 * 1000 };
  return result.apiKey;
}
async function request(path: string) {
  if (!path.startsWith("/"))
    throw new BankError("Caminho de consulta inválido.");
  const url = new URL(path, "https://api.pluggy.ai");
  if (url.origin !== "https://api.pluggy.ai")
    throw new BankError("Endereço inválido.");
  let response = await fetch(url, {
    headers: { "X-API-KEY": await key() },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (response.status === 401) {
    apiKey = undefined;
    response = await fetch(url, {
      headers: { "X-API-KEY": await key() },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  }
  if (response.status === 429)
    throw new BankError(
      "Limite de consulta atingido. Aguarde antes de continuar; o progresso foi preservado.",
    );
  if (response.status === 403)
    throw new BankError(
      "A fonte não autorizou esta consulta. Confira consentimento e acesso ao endpoint v2.",
    );
  if (!response.ok)
    throw new BankError(
      "A fonte não respondeu como esperado. Seu histórico foi preservado; tente novamente mais tarde.",
    );
  return response.json();
}
const remoteTransaction = z.object({
  id: z.string(),
  providerId: z.string().nullish(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  currencyCode: z.string(),
  type: z.enum(["DEBIT", "CREDIT"]),
  status: z.string(),
  creditCardMetadata: z
    .object({ totalInstallments: z.number().optional() })
    .nullish(),
});
export function validatedNext(next: string, accountId: string): string {
  const url = new URL(
    next.startsWith("?") ? `/v2/transactions${next}` : next,
    "https://api.pluggy.ai",
  );
  if (
    url.origin !== "https://api.pluggy.ai" ||
    url.pathname !== "/v2/transactions" ||
    url.searchParams.get("accountId") !== accountId ||
    !url.searchParams.get("after")
  )
    throw new BankError(
      "A fonte retornou uma paginação inesperada. A consulta foi interrompida com segurança.",
    );
  return url.pathname + url.search;
}
export async function syncPluggy(
  ownerId: string,
  itemId: string,
): Promise<string> {
  if (!pluggyConfigured())
    throw new BankError(
      "Configure o Client ID e o Client Secret da Pluggy no servidor.",
    );
  if (!z.uuid().safeParse(itemId).success)
    throw new BankError("Informe um Item ID válido do conector MeuPluggy.");
  const database = db(),
    id = `${ownerId}:${itemId}`,
    token = randomUUID();
  await database
    .insert(bankSyncs)
    .values({ id, ownerId, itemId, status: "idle", state: null })
    .onConflictDoNothing();
  const claimed = await database
    .update(bankSyncs)
    .set({
      lockToken: token,
      lockedUntil: new Date(Date.now() + 60000),
      status: "running",
    })
    .where(
      and(
        eq(bankSyncs.id, id),
        or(
          isNull(bankSyncs.lockedUntil),
          lt(bankSyncs.lockedUntil, new Date()),
        ),
      ),
    )
    .returning();
  if (!claimed.length)
    throw new BankError(
      "Já existe uma consulta em andamento. Aguarde um instante.",
    );
  let state = claimed[0].state;
  const started = Date.now();
  async function checkpoint(next: BankSyncState) {
    const changed = await database
      .update(bankSyncs)
      .set({ state: next })
      .where(and(eq(bankSyncs.id, id), eq(bankSyncs.lockToken, token)))
      .returning({ id: bankSyncs.id });
    if (!changed.length)
      throw new BankError(
        "Esta execução foi substituída. Continue a consulta para retomar.",
      );
  }
  try {
    const item = z
      .object({
        id: z.string(),
        consentExpiresAt: z.string().nullish(),
        status: z.string(),
        connector: z.object({ id: z.number(), name: z.string() }).passthrough(),
      })
      .parse(await request(`/items/${encodeURIComponent(itemId)}`));
    if (item.consentExpiresAt && new Date(item.consentExpiresAt) < new Date())
      throw new BankError(
        "A autorização expirou. Renove no Meu Pluggy antes de continuar. Seu histórico foi preservado.",
      );
    if (["LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT"].includes(item.status))
      throw new BankError(
        "A conexão exige uma ação no Meu Pluggy ou no banco antes de consultar os movimentos.",
      );
    if (
      !state ||
      (state.index >= state.accounts.length && state.rows.length === 0)
    ) {
      const accounts = z
        .object({
          results: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              number: z.string().nullish(),
              type: z.string(),
            }),
          ),
        })
        .parse(await request(`/accounts?itemId=${encodeURIComponent(itemId)}`));
      if (!accounts.results.length)
        throw new BankError(
          "Nenhuma conta foi disponibilizada. Confira o consentimento; nenhum histórico foi removido.",
        );
      const existingBatch = claimed[0].state?.batchId;
      state = {
        accounts: accounts.results.map((a) => ({
          id: a.id,
          label: `${item.connector.name} · ${a.name}`,
          scope: a.number
            ? `${item.connector.id}:${a.type}:${createHash("sha256").update(a.number).digest("hex").slice(0, 24)}`
            : `item:${itemId}:${a.id}`,
        })),
        index: 0,
        next: null,
        rows: [],
        skipped: 0,
        batchId: existingBatch ?? randomUUID(),
      };
      await checkpoint(state);
    }
    let pages = 0;
    while (
      state.index < state.accounts.length &&
      Date.now() - started < 14000 &&
      pages < 4
    ) {
      const account = state.accounts[state.index];
      const path =
        state.next ??
        `/v2/transactions?accountId=${encodeURIComponent(account.id)}`;
      const page = z
        .object({ results: z.array(z.unknown()), next: z.string().nullable() })
        .parse(await request(path));
      for (const raw of page.results) {
        const parsed = remoteTransaction.safeParse(raw);
        if (!parsed.success) {
          state.skipped++;
          continue;
        }
        const t = parsed.data;
        if (!["BRL", "USD"].includes(t.currencyCode)) {
          state.skipped++;
          continue;
        }
        const day = t.date.slice(0, 10);
        if (!z.iso.date().safeParse(day).success) {
          state.skipped++;
          continue;
        }
        // Pluggy supplies a bank posting date. Preserve that civil date; do not shift midnight to the previous day.
        const sourceKey = `pluggy|${account.scope}|${t.providerId ? `provider:${t.providerId}` : `id:${t.id}`}`;
        const entry: Transaction = {
          id: randomUUID(),
          date: day,
          description: t.description.slice(0, 300),
          amount: Math.abs(t.amount).toString(),
          currency: t.currencyCode as "BRL" | "USD",
          direction: t.type === "DEBIT" ? "debit" : "credit",
          kind:
            (t.creditCardMetadata?.totalInstallments ?? 0) > 1
              ? "installment"
              : transactionKind(
                  t.description,
                  t.type === "DEBIT" ? "debit" : "credit",
                ),
          account: account.label,
          sourceKey,
          importId: state.batchId,
          subscriptionId: null,
          pending: t.status !== "POSTED",
        };
        const previous = state.rows.findIndex(
          (row) => row.sourceKey === sourceKey,
        );
        if (previous >= 0) state.rows[previous] = entry;
        else state.rows.push(entry);
      }
      if (state.rows.length > 20000)
        throw new BankError(
          "Esta fonte excedeu 20 mil movimentos por consulta. Use uma importação por arquivo para limitar o intervalo.",
        );
      if (page.next) state.next = validatedNext(page.next, account.id);
      else {
        state.index++;
        state.next = null;
      }
      pages++;
      await checkpoint(state);
    }
    if (state.index < state.accounts.length) {
      await database
        .update(bankSyncs)
        .set({ status: "partial" })
        .where(and(eq(bankSyncs.id, id), eq(bankSyncs.lockToken, token)));
      return `${state.rows.length} movimentos preparados. Clique em consultar novamente para continuar; o lote só será publicado quando estiver completo.`;
    }
    const current = await loadWorkspace(ownerId);
    const incoming = new Map(state.rows.map((t) => [t.sourceKey, t]));
    const transactions = current.transactions.map((t) => {
      const updated = incoming.get(t.sourceKey);
      if (!updated) return t;
      incoming.delete(t.sourceKey);
      return {
        ...updated,
        id: t.id,
        subscriptionId: t.subscriptionId,
        importId: t.importId,
      };
    });
    const newRows = [...incoming.values()];
    const count = state.rows.length;
    const batch = {
      id: state.batchId,
      name: `Meu Pluggy · ${item.connector.name}`,
      hash: `pluggy:${itemId}`,
      count,
      source: "pluggy" as const,
      createdAt: new Date().toISOString(),
    };
    await saveWorkspace(
      ownerId,
      {
        ...current,
        transactions: [...transactions, ...newRows],
        imports: [...current.imports.filter((b) => b.id !== batch.id), batch],
      },
      { bankLease: { id, token } },
    );
    await database
      .update(bankSyncs)
      .set({
        status: "complete",
        state: { ...state, rows: [] },
        lastSuccessAt: new Date(),
      })
      .where(and(eq(bankSyncs.id, id), eq(bankSyncs.lockToken, token)));
    return `${newRows.length} novos movimentos; ${count - newRows.length} atualizados. ${state.skipped ? `${state.skipped} registros incompatíveis não foram importados. ` : ""}Confira possíveis sobreposições com CSV em Movimentos. Nenhum movimento ausente foi apagado.`;
  } finally {
    await database
      .update(bankSyncs)
      .set({ lockToken: null, lockedUntil: null })
      .where(and(eq(bankSyncs.id, id), eq(bankSyncs.lockToken, token)));
  }
}
