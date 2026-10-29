import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

mkdirSync(".local", { recursive: true });
if (!existsSync(".env.local"))
  writeFileSync(
    ".env.local",
    `DATABASE_URL=postgresql://saastemics@127.0.0.1:55432/saastemics\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nBETTER_AUTH_URL=http://127.0.0.1:3000\nOWNER_EMAIL=local@saastemics.test\nLOCAL_DEV_AUTH=true\nLOCAL_OWNER_PASSWORD=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55432" ||
  url.username !== "saastemics"
)
  throw new Error(
    "Setup local não altera um banco externo ou configuração existente.",
  );
const pgBin = process.env.LOCAL_PG_BIN ?? "/opt/homebrew/opt/postgresql@18/bin";
const data = `${process.cwd()}/.local/postgres`;
if (existsSync(`${pgBin}/initdb`)) {
  if (!existsSync(`${data}/PG_VERSION`))
    execFileSync(
      `${pgBin}/initdb`,
      [
        "-D",
        data,
        "-U",
        "saastemics",
        "--auth-local=trust",
        "--auth-host=trust",
        "--encoding=UTF8",
        "--no-locale",
      ],
      { stdio: "ignore" },
    );
  try {
    execFileSync(`${pgBin}/pg_ctl`, ["-D", data, "status"], {
      stdio: "ignore",
    });
  } catch {
    execFileSync(
      `${pgBin}/pg_ctl`,
      [
        "-D",
        data,
        "-l",
        `${process.cwd()}/.local/postgres.log`,
        "-o",
        "-p 55432 -h 127.0.0.1",
        "start",
      ],
      { stdio: "ignore" },
    );
  }
} else {
  execFileSync("docker", ["compose", "up", "-d", "--wait"], {
    stdio: "inherit",
  });
}
const admin = new Pool({
  connectionString: "postgresql://saastemics@127.0.0.1:55432/postgres",
});
try {
  const result = await admin.query(
    "select 1 from pg_database where datname = $1",
    ["saastemics"],
  );
  if (!result.rowCount) await admin.query('create database "saastemics"');
} finally {
  await admin.end();
}
execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
  env: { ...process.env, MIGRATION_DATABASE_URL: process.env.DATABASE_URL },
  stdio: "inherit",
});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const email = process.env.OWNER_EMAIL!,
    password = await hashPassword(process.env.LOCAL_OWNER_PASSWORD!);
  await pool.query(
    "insert into app_user (id,name,email,email_verified) values ($1,$2,$3,true) on conflict (id) do nothing",
    ["local-owner", "Você", email],
  );
  await pool.query(
    "insert into auth_account (id,account_id,provider_id,user_id,password) values ($1,$2,$3,$4,$5) on conflict (id) do update set password = excluded.password",
    ["local-credential", "local-owner", "credential", "local-owner", password],
  );
} finally {
  await pool.end();
}
console.log(
  "Ambiente local pronto. Rode npm run dev e use ‘Entrar no ambiente local’. Nenhuma assinatura de exemplo foi inserida no banco.",
);
