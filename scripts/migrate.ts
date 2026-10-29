import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { databaseConnectionString } from "../src/server/db/connection";
config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error("Defina DATABASE_URL antes de migrar.");
const pool = new Pool({
  connectionString: databaseConnectionString(
    process.env.MIGRATION_DATABASE_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL,
  ),
  max: 1,
});
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Migrações aplicadas.");
} finally {
  await pool.end();
}
