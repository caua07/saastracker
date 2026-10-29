import { z } from "zod";

export const CATEGORIES = [
  "Desenvolvimento",
  "Inteligência artificial",
  "Infraestrutura",
  "Produtividade",
  "Entretenimento",
  "Outros",
] as const;
export const moneySchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,6})?$/, "Informe um valor válido.");
export const currencySchema = z.enum(["BRL", "USD"]);
export const cycleSchema = z.enum(["monthly", "yearly", "weekly", "quarterly"]);
export const termSchema = z
  .object({
    effectiveFrom: z.iso.date(),
    amount: moneySchema,
    currency: currencySchema,
    cycle: cycleSchema,
  })
  .strict();
export const subscriptionSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    service: z.string().max(40),
    amount: moneySchema,
    currency: currencySchema,
    cycle: cycleSchema,
    category: z.string().trim().min(1).max(60),
    status: z.enum(["active", "trial", "paused", "canceled", "archived"]),
    anchorDate: z.iso.date(),
    startDate: z.iso.date(),
    cancelDate: z.iso.date().nullable(),
    website: z.union([
      z.literal(""),
      z
        .url()
        .refine(
          (v) => new URL(v).protocol === "https:",
          "Use um endereço HTTPS.",
        ),
    ]),
    notes: z.string().max(2000),
    history: z.array(termSchema).max(200),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((s) => !s.cancelDate || s.cancelDate >= s.startDate, {
    message: "O término não pode anteceder o início.",
    path: ["cancelDate"],
  });

export const transactionSchema = z
  .object({
    id: z.uuid(),
    date: z.iso.date(),
    description: z.string().min(1).max(300),
    amount: moneySchema,
    currency: currencySchema,
    direction: z.enum(["debit", "credit"]),
    kind: z.enum([
      "expense",
      "refund",
      "transfer",
      "invoice_payment",
      "installment",
    ]),
    account: z.string().min(1).max(100),
    sourceKey: z.string().min(1).max(700),
    importId: z.uuid(),
    subscriptionId: z.uuid().nullable(),
    pending: z.boolean(),
  })
  .strict();
export const preferencesSchema = z
  .object({
    displayName: z.string().trim().max(50),
    baseCurrency: currencySchema,
    usdBrl: z.union([
      z.literal(""),
      moneySchema.refine((v) => Number(v) > 0 && Number(v) < 10000),
    ]),
    fxDate: z.iso.date().nullable(),
    reminderDays: z.number().int().min(0).max(30),
    compact: z.boolean(),
  })
  .strict()
  .refine((v) => !v.usdBrl || v.fxDate !== null, {
    message: "Informe a data da cotação.",
    path: ["fxDate"],
  });
export const importSchema = z
  .object({
    id: z.uuid(),
    name: z.string().max(150),
    hash: z.string().max(100),
    count: z.number().int().min(0),
    createdAt: z.iso.datetime(),
    source: z.enum(["csv", "pluggy"]),
  })
  .strict();
export const decisionSchema = z
  .object({
    key: z.string().max(300),
    evidenceHash: z.string().max(5000),
    status: z.enum(["rejected", "confirmed", "snoozed"]),
    subscriptionId: z.uuid().nullable(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const workspaceSchema = z
  .object({
    version: z.number().int().nonnegative(),
    subscriptions: z.array(subscriptionSchema).max(1000),
    transactions: z.array(transactionSchema).max(50000),
    imports: z.array(importSchema).max(1000),
    decisions: z.array(decisionSchema).max(5000),
    preferences: preferencesSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const field of ["subscriptions", "transactions", "imports"] as const) {
      const ids = data[field].map((v) => v.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Há identificadores duplicados.",
        });
    }
    if (
      new Set(data.transactions.map((t) => t.sourceKey)).size !==
      data.transactions.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: "Há movimentos de origem duplicados.",
      });
    const ids = new Set(data.subscriptions.map((v) => v.id));
    const batches = new Set(data.imports.map((v) => v.id));
    for (const t of data.transactions) {
      if (t.subscriptionId && !ids.has(t.subscriptionId))
        ctx.addIssue({
          code: "custom",
          message: "Movimento ligado a assinatura inexistente.",
        });
      if (!batches.has(t.importId))
        ctx.addIssue({
          code: "custom",
          message: "Movimento sem lote de origem.",
        });
    }
  });
export type Currency = z.infer<typeof currencySchema>;
export type Cycle = z.infer<typeof cycleSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;

export function emptyWorkspace(): Workspace {
  return {
    version: 0,
    subscriptions: [],
    transactions: [],
    imports: [],
    decisions: [],
    preferences: {
      displayName: "",
      baseCurrency: "BRL",
      usdBrl: "",
      fxDate: null,
      reminderDays: 7,
      compact: false,
    },
  };
}

export const backupSchema = z
  .object({
    format: z.literal("saastemics"),
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    data: workspaceSchema,
  })
  .strict();
