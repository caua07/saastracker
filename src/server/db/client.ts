import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { databaseConnectionString } from "./connection";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { saastemicsPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("Banco de dados não configurado.");
  if (!globalDb.saastemicsPool) {
    const pool = new Pool({
      connectionString: databaseConnectionString(process.env.DATABASE_URL),
      max: 3,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
    globalDb.saastemicsPool = pool;
  }
  return globalDb.saastemicsPool;
}
export function db() {
  return drizzle(getPool(), { schema });
}
