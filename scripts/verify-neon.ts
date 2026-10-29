import { config } from "dotenv";
import { Pool } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { databaseConnectionString } from "../src/server/db/connection";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.argv.includes("--allow-production-smoke"))
  throw new Error(
    "Use --allow-production-smoke para autorizar dados sintéticos temporários na branch configurada.",
  );
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).hostname.endsWith(".neon.tech")
)
  throw new Error("Este teste exige a conexão Neon configurada.");
for (const key of [
  "DATABASE_URL_UNPOOLED",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
])
  if (!process.env[key]) throw new Error(`Configure ${key}.`);

const id = `neon-smoke-${randomUUID()}`;
const email = `${id}@saastemics.test`;
const password = randomBytes(32).toString("hex");
const base = "http://127.0.0.1:3002";
const admin = new Pool({
  connectionString: databaseConnectionString(
    process.env.DATABASE_URL_UNPOOLED!,
  ),
  max: 1,
});
const s3 = new S3Client({
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let server: ReturnType<typeof spawn> | undefined;
mkdirSync(".local/neon-setup", { recursive: true });
mkdirSync(".impeccable/review/neon", { recursive: true });
const evidence: string[] = [];
function pass(message: string) {
  evidence.push(`PASS ${message}`);
  console.log(`PASS ${message}`);
}
try {
  await admin.query(
    "insert into app_user(id,name,email,email_verified) values($1,$2,$3,true)",
    [id, "Verificação Neon", email],
  );
  await admin.query(
    "insert into auth_account(id,account_id,provider_id,user_id,password) values($1,$2,'credential',$3,$4)",
    [`${id}-credential`, id, id, await hashPassword(password)],
  );
  const log = openSync(".local/neon-setup/app.log", "a", 0o600);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3002",
    ],
    {
      detached: true,
      stdio: ["ignore", log, log],
      env: {
        ...process.env,
        E2E_SERVER: "true",
        OWNER_EMAIL: email,
        OWNER_GOOGLE_SUB: "",
        BETTER_AUTH_URL: base,
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        LOCAL_DEV_AUTH: "true",
        LOCAL_OWNER_PASSWORD: password,
      },
    },
  );
  closeSync(log);
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error("Servidor encerrou antes de ficar pronto.");
    try {
      if (
        (await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) })).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  if (!ready) throw new Error("Servidor não ficou pronto.");
  pass("APP GET /login HTTP 200 (Neon env)");
  expect((await fetch(`${base}/api/backups`)).status).toBe(401);
  pass("SECURITY anonymous cloud backup HTTP 401");
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: "Entrar no ambiente local" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  pass(
    "AUTH local test identity/session persisted in Neon (production Google not exercised)",
  );
  await page
    .getByRole("button", { name: "Adicionar assinatura", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome", { exact: true })
    .fill("Neon smoke subscription");
  await page
    .getByRole("dialog")
    .getByLabel("Valor", { exact: true })
    .fill("120");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Adicionar assinatura", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .getByText("Assinatura adicionada", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".service-identity")
      .getByText("Neon smoke subscription", { exact: true }),
  ).toBeVisible();
  const rows = await admin.query(
    "select count(*)::int as count from subscriptions where owner_id=$1 and name=$2",
    [id, "Neon smoke subscription"],
  );
  expect(rows.rows[0].count).toBe(1);
  pass("POSTGRES UI create -> committed row -> reload preserved subscription");
  expect(
    (
      await page.request.post(`${base}/api/backups`, {
        headers: { Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  pass("SECURITY cross-origin cloud mutation HTTP 403");
  expect((await page.request.get(`${base}/api/backups`)).status()).toBe(404);
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar na nuvem", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .getByText("Cópia salva na nuvem. A cópia anterior foi substituída.", {
        exact: true,
      }),
  ).toBeVisible({ timeout: 30000 });
  const response = await page.request.get(`${base}/api/backups`);
  expect(response.status()).toBe(200);
  const backup = await response.json();
  expect(backup.data.subscriptions).toHaveLength(1);
  expect(backup.data.subscriptions[0].name).toBe("Neon smoke subscription");
  expect(backup.schemaVersion).toBe(1);
  pass(
    "OBJECT STORAGE UI save -> private S3 PUT -> authenticated GET HTTP 200, snapshot matches Postgres",
  );
  const anonymous = await fetch(
    `${process.env.AWS_ENDPOINT_URL_S3}/assets/owners/${id}/backup.json`,
  );
  expect([401, 403]).toContain(anonymous.status);
  pass("SECURITY anonymous direct object read denied");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Baixar da nuvem", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("saastemics-cloud.json");
  pass("OBJECT STORAGE browser downloaded saastemics-cloud.json");
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  pass("UI settings axe WCAG A/AA zero violations");
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("heading", { name: "Uma cópia na nuvem" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".impeccable/review/neon/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("heading", { name: "Uma cópia na nuvem" })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".impeccable/review/neon/mobile.png" });
  pass("UI 390px no horizontal overflow");
  await page
    .getByRole("button", { name: "Excluir cópia", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Excluir cópia", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden({ timeout: 30000 });
  expect((await page.request.get(`${base}/api/backups`)).status()).toBe(404);
  pass("OBJECT STORAGE UI confirmation -> DELETE -> missing backup HTTP 404");
} finally {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
  await s3.send(
    new DeleteObjectCommand({
      Bucket: "assets",
      Key: `owners/${id}/backup.json`,
    }),
  );
  s3.destroy();
  await admin.query("delete from app_user where id=$1", [id]);
  const remaining = await admin.query(
    "select count(*)::int as count from app_user where id=$1",
    [id],
  );
  expect(remaining.rows[0].count).toBe(0);
  await admin.end();
  pass("CLEANUP temporary identity, rows and object removed; server stopped");
  writeFileSync(
    ".local/neon-setup/verification.txt",
    evidence.join("\n") + "\n",
    { mode: 0o600 },
  );
}
