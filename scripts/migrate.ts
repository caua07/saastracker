import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error("Defina DATABASE_URL antes de migrar.");
const pool = new Pool({
  connectionString:
    process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
  max: 1,
});
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Migrações aplicadas.");
} finally {
  await pool.end();
}
