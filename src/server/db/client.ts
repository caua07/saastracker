import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { saastemicsPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("Banco de dados não configurado.");
  return (globalDb.saastemicsPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  }));
}
export function db() {
  return drizzle(getPool(), { schema });
}
