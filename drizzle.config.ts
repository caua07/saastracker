import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
