import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Preferences } from "@/domain/model";
import type { BankSyncState } from "../integrations/pluggy";

export const user = pgTable("app_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const session = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    uniqueIndex("account_provider_idx").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const ownerSettings = pgTable("owner_settings", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(0),
  preferences: jsonb("preferences").$type<Preferences>().notNull(),
});
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    service: text("service").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    currency: text("currency").notNull(),
    cycle: text("cycle").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
    anchorDate: date("anchor_date").notNull(),
    startDate: date("start_date").notNull(),
    cancelDate: date("cancel_date"),
    website: text("website").notNull(),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("subscription_owner_idx").on(t.ownerId)],
);
export const terms = pgTable(
  "subscription_terms",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    effectiveFrom: date("effective_from").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    currency: text("currency").notNull(),
    cycle: text("cycle").notNull(),
  },
  (t) => [uniqueIndex("term_date_idx").on(t.subscriptionId, t.effectiveFrom)],
);
export const imports = pgTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hash: text("hash").notNull(),
    count: integer("count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    source: text("source").notNull(),
  },
  (t) => [index("import_owner_idx").on(t.ownerId)],
);
export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
    currency: text("currency").notNull(),
    direction: text("direction").notNull(),
    kind: text("kind").notNull(),
    account: text("account").notNull(),
    sourceKey: text("source_key").notNull(),
    importId: text("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    pending: boolean("pending").notNull(),
  },
  (t) => [
    uniqueIndex("transaction_source_idx").on(t.ownerId, t.sourceKey),
    index("transaction_owner_date_idx").on(t.ownerId, t.date),
  ],
);
export const decisions = pgTable(
  "discovery_decisions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    status: text("status").notNull(),
    subscriptionId: text("subscription_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("decision_owner_idx").on(t.ownerId)],
);
export const bankSyncs = pgTable(
  "bank_syncs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    status: text("status").notNull(),
    state: jsonb("state").$type<BankSyncState>(),
    lockToken: text("lock_token"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [index("bank_sync_owner_idx").on(t.ownerId)],
);
