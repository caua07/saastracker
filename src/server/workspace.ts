import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "./db/client";
import * as t from "./db/schema";
import {
  emptyWorkspace,
  workspaceSchema,
  type Workspace,
} from "@/domain/model";

export class ConflictError extends Error {}
export async function loadWorkspace(ownerId: string): Promise<Workspace> {
  return db().transaction(
    async (database) => {
      const settings = await database
        .select()
        .from(t.ownerSettings)
        .where(eq(t.ownerSettings.ownerId, ownerId));
      const subs = await database
        .select()
        .from(t.subscriptions)
        .where(eq(t.subscriptions.ownerId, ownerId));
      const txs = await database
        .select()
        .from(t.transactions)
        .where(eq(t.transactions.ownerId, ownerId));
      const batches = await database
        .select()
        .from(t.imports)
        .where(eq(t.imports.ownerId, ownerId));
      const reviews = await database
        .select()
        .from(t.decisions)
        .where(eq(t.decisions.ownerId, ownerId));
      const conditions = subs.length
        ? await database
            .select()
            .from(t.terms)
            .where(
              inArray(
                t.terms.subscriptionId,
                subs.map((s) => s.id),
              ),
            )
        : [];
      return workspaceSchema.parse({
        version: settings[0]?.revision ?? 0,
        preferences: settings[0]?.preferences ?? emptyWorkspace().preferences,
        subscriptions: subs.map(
          ({ ownerId: _, createdAt, updatedAt, ...s }) => ({
            ...s,
            amount: new Decimal(s.amount).toFixed(),
            createdAt: createdAt.toISOString(),
            updatedAt: updatedAt.toISOString(),
            history: conditions
              .filter((c) => c.subscriptionId === s.id)
              .map(({ id: __, subscriptionId: ___, ...term }) => ({
                ...term,
                amount: new Decimal(term.amount).toFixed(),
              })),
          }),
        ),
        transactions: txs.map(({ ownerId: _, ...x }) => ({
          ...x,
          amount: new Decimal(x.amount).toFixed(),
        })),
        imports: batches.map(({ ownerId: _, createdAt, ...x }) => ({
          ...x,
          createdAt: createdAt.toISOString(),
        })),
        decisions: reviews.map(({ id: _, ownerId: __, updatedAt, ...x }) => ({
          ...x,
          updatedAt: updatedAt.toISOString(),
        })),
      });
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function saveWorkspace(
  ownerId: string,
  input: Workspace,
  options: {
    resetConnections?: boolean;
    bankLease?: { id: string; token: string };
  } = {},
): Promise<number> {
  const data = workspaceSchema.parse(input);
  const database = db();
  return database.transaction(async (tx) => {
    await tx
      .insert(t.ownerSettings)
      .values({
        ownerId,
        revision: 0,
        preferences: emptyWorkspace().preferences,
      })
      .onConflictDoNothing();
    const [settings] = await tx
      .select()
      .from(t.ownerSettings)
      .where(eq(t.ownerSettings.ownerId, ownerId))
      .for("update");
    if (settings.revision !== data.version)
      throw new ConflictError(
        "Os dados mudaram em outra aba. Recarregue antes de continuar.",
      );
    if (options.bankLease) {
      const [lease] = await tx
        .select()
        .from(t.bankSyncs)
        .where(
          and(
            eq(t.bankSyncs.id, options.bankLease.id),
            eq(t.bankSyncs.ownerId, ownerId),
          ),
        )
        .for("update");
      if (
        !lease ||
        lease.lockToken !== options.bankLease.token ||
        !lease.lockedUntil ||
        lease.lockedUntil < new Date()
      )
        throw new ConflictError(
          "A consulta foi interrompida ou substituída. Nenhum dado antigo foi republicado.",
        );
    }
    if (options.resetConnections)
      await tx.delete(t.bankSyncs).where(eq(t.bankSyncs.ownerId, ownerId));
    await tx.delete(t.transactions).where(eq(t.transactions.ownerId, ownerId));
    await tx.delete(t.imports).where(eq(t.imports.ownerId, ownerId));
    await tx.delete(t.decisions).where(eq(t.decisions.ownerId, ownerId));
    await tx
      .delete(t.subscriptions)
      .where(eq(t.subscriptions.ownerId, ownerId));
    if (data.subscriptions.length) {
      await tx.insert(t.subscriptions).values(
        data.subscriptions.map(
          ({ history: _, createdAt, updatedAt, ...s }) => ({
            ...s,
            ownerId,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          }),
        ),
      );
      const terms = data.subscriptions.flatMap((s) =>
        s.history.map((term) => ({ ...term, subscriptionId: s.id })),
      );
      if (terms.length) await tx.insert(t.terms).values(terms);
    }
    if (data.imports.length)
      await tx.insert(t.imports).values(
        data.imports.map(({ createdAt, ...b }) => ({
          ...b,
          ownerId,
          createdAt: new Date(createdAt),
        })),
      );
    for (let i = 0; i < data.transactions.length; i += 500)
      await tx
        .insert(t.transactions)
        .values(
          data.transactions.slice(i, i + 500).map((x) => ({ ...x, ownerId })),
        );
    if (data.decisions.length)
      await tx.insert(t.decisions).values(
        data.decisions.map(({ updatedAt, ...d }) => ({
          ...d,
          ownerId,
          updatedAt: new Date(updatedAt),
        })),
      );
    await tx
      .update(t.ownerSettings)
      .set({ revision: data.version + 1, preferences: data.preferences })
      .where(eq(t.ownerSettings.ownerId, ownerId));
    return data.version + 1;
  });
}
