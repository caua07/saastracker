import { config } from "dotenv";
import { Pool } from "pg";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

config({ path: ".env.local", quiet: true });
const adminUrl = new URL(process.env.DATABASE_URL ?? "");
if (adminUrl.hostname !== "127.0.0.1" || adminUrl.port !== "55432")
  throw new Error(
    "E2E só usa o PostgreSQL local isolado, após npm run setup:local.",
  );
adminUrl.pathname = "/postgres";
const admin = new Pool({ connectionString: adminUrl.toString() });
try {
  if (
    !(
      await admin.query("select 1 from pg_database where datname=$1", [
        "saastemics_e2e",
      ])
    ).rowCount
  )
    await admin.query('create database "saastemics_e2e"');
} finally {
  await admin.end();
}
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = "/saastemics_e2e";
const ownerEmail = "e2e@saastemics.test",
  password = randomBytes(32).toString("hex");
const env = {
  ...process.env,
  E2E_SERVER: "true",
  DATABASE_URL: databaseUrl.toString(),
  MIGRATION_DATABASE_URL: databaseUrl.toString(),
  BETTER_AUTH_URL: "http://127.0.0.1:3001",
  OWNER_EMAIL: ownerEmail,
  LOCAL_DEV_AUTH: "true",
  LOCAL_OWNER_PASSWORD: password,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "e2e-only-google-secret",
  PLUGGY_CLIENT_ID: "",
  PLUGGY_CLIENT_SECRET: "",
  AWS_ACCESS_KEY_ID: "",
  AWS_SECRET_ACCESS_KEY: "",
  AWS_ENDPOINT_URL_S3: "",
  AWS_REGION: "",
};
execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
  env,
  stdio: "inherit",
});
const pool = new Pool({ connectionString: databaseUrl.toString() });
try {
  await pool.query(
    "insert into app_user(id,name,email,email_verified) values($1,$2,$3,true) on conflict(id) do nothing",
    ["e2e-owner", "Teste", ownerEmail],
  );
  await pool.query(
    "insert into auth_account(id,account_id,provider_id,user_id,password) values($1,$2,$3,$4,$5) on conflict(id) do update set password=excluded.password",
    [
      "e2e-credential",
      "e2e-owner",
      "credential",
      "e2e-owner",
      await hashPassword(password),
    ],
  );
} finally {
  await pool.end();
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  { env, stdio: "inherit" },
);
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => process.exit(code ?? 0));
