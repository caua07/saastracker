import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyWorkspace } from "../../src/domain/model";
import { readFile, mkdir } from "node:fs/promises";
import { sampleWorkspace } from "../support/workspace";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar no ambiente local" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
}
async function reset(page: Page) {
  const current = await (await page.request.get("/api/workspace")).json();
  const response = await page.request.put("/api/workspace", {
    data: { ...emptyWorkspace(), version: current.version },
    headers: { Origin: "http://127.0.0.1:3001", "X-Reset-Connections": "true" },
  });
  expect(response.ok()).toBeTruthy();
  await page.reload();
}
test("API privada e origem externa recusadas", async ({ page, request }) => {
  expect((await request.get("/api/workspace")).status()).toBe(401);
  await signIn(page);
  expect(
    (
      await page.request.put("/api/workspace", {
        data: emptyWorkspace(),
        headers: { Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get("/api/cron")).status()).toBe(401);
});
test("Google inicia OAuth com estado persistido e bloqueia origem externa", async ({
  request,
}) => {
  const response = await request.post("/api/auth/sign-in/social", {
    headers: { Origin: "http://127.0.0.1:3001" },
    data: { provider: "google", callbackURL: "/", disableRedirect: true },
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  const url = new URL(result.url);
  expect(url.hostname).toBe("accounts.google.com");
  expect(url.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:3001/api/auth/callback/google",
  );
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(response.headers()["set-cookie"]).toBeTruthy();
  const blocked = await request.post("/api/auth/sign-in/social", {
    headers: {
      Origin: "https://other.example",
      "Sec-Fetch-Site": "cross-site",
    },
    data: { provider: "google", callbackURL: "/", disableRedirect: true },
  });
  expect(blocked.status()).toBe(403);
});
test("falha vazia do servidor de login mostra mensagem e permite tentar novamente", async ({
  page,
}) => {
  await page.route("**/api/auth/sign-in/social", (route) =>
    route.fulfill({ status: 500, body: "" }),
  );
  await page.goto("/login");
  const google = page.getByRole("button", {
    name: "Entrar com Google",
    exact: true,
  });
  await google.click();
  const failure = page
    .getByRole("alert")
    .filter({ hasText: "O servidor de login está indisponível" });
  await expect(failure).toContainText("O servidor de login está indisponível");
  await expect(failure).not.toContainText("JSON");
  await expect(google).toBeEnabled();
  await mkdir(".impeccable/review/auth-error", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".impeccable/review/auth-error/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".login-preview")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".impeccable/review/auth-error/mobile.png",
    fullPage: true,
  });
});
test("cadastro anual, persistência, edição, backup e concorrência", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page
    .getByRole("button", { name: "Adicionar assinatura", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Serviço de teste");
  await dialog.getByLabel("Valor", { exact: true }).fill("120");
  await dialog.getByLabel("Moeda", { exact: true }).selectOption("USD");
  await dialog.getByLabel("Frequência").selectOption("yearly");
  await dialog
    .getByRole("button", { name: "Adicionar assinatura", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .getByText("Assinatura adicionada", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".service-identity").getByText("Serviço de teste"),
  ).toBeVisible();
  await page
    .locator(".service-identity")
    .filter({ hasText: "Serviço de teste" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("US$ 10,00 por mês equivalente", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar assinatura", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Serviço atualizado");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup JSON", exact: true }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toMatch(/saastemics.*\.json/);
  const backupText = await readFile((await backup.path())!, "utf8");
  expect(JSON.parse(backupText).data.subscriptions[0].name).toBe(
    "Serviço atualizado",
  );
  await page
    .getByRole("button", { name: "Excluir meus dados", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Excluir meus dados", exact: true })
    .click();
  await expect
    .poll(async () => {
      const saved = await (await page.request.get("/api/workspace")).json();
      return saved.subscriptions.length;
    })
    .toBe(0);
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backupText),
    });
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Substituir e restaurar", exact: true })
    .click();
  await expect
    .poll(async () => {
      const saved = await (await page.request.get("/api/workspace")).json();
      return saved.subscriptions.map((item: { name: string }) => item.name);
    })
    .toEqual(["Serviço atualizado"]);
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  const stale = await (await page.request.get("/api/workspace")).json();
  const updated = {
    ...stale,
    preferences: { ...stale.preferences, displayName: "Atualizado" },
  };
  expect(
    (
      await page.request.put("/api/workspace", {
        data: updated,
        headers: { Origin: "http://127.0.0.1:3001" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.put("/api/workspace", {
        data: stale,
        headers: { Origin: "http://127.0.0.1:3001" },
      })
    ).status(),
  ).toBe(409);
});
test("CSV vira sugestão, confirma e não duplica ao reimportar", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  const csv =
    "date,description,amount,currency\n2026-08-10,GITHUB INC,-10,USD\n2026-09-11,GITHUB INC,-10,USD\n2026-10-10,GITHUB INC,-10,USD";
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "extrato.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  await page
    .getByRole("button", { name: "Importar 3 movimentos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Extrato importado", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page.getByRole("button", { name: /^Descoberta/ }).click();
  await expect(
    page.getByRole("heading", { name: "GitHub", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar assinatura", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar assinatura", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .getByText("Assinatura adicionada", { exact: true }),
  ).toBeVisible();
  const current = await (await page.request.get("/api/workspace")).json();
  expect(current.subscriptions).toHaveLength(1);
  expect(
    current.transactions.filter(
      (t: { subscriptionId: string }) => t.subscriptionId,
    ),
  ).toHaveLength(3);
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "extrato.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  await expect(
    page.getByText(
      "Todos os movimentos reconhecidos já estão registrados nesta conta. Nada será duplicado.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Importar 0 movimentos", exact: true }),
  ).toBeDisabled();
});
test("acesso privado sem demo, mobile sem overflow e acessibilidade", async ({
  page,
}) => {
  expect((await page.request.get("/demo")).status()).toBe(404);
  await page.goto("/login");
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
  await expect(page.getByText(/Explorar a demonstração/)).toHaveCount(0);
  await mkdir(".impeccable/review/no-demo", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".impeccable/review/no-demo/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".login-preview")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".impeccable/review/no-demo/mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await signIn(page);
  await reset(page);
  const current = await (await page.request.get("/api/workspace")).json();
  const response = await page.request.put("/api/workspace", {
    data: { ...sampleWorkspace(), version: current.version },
    headers: { Origin: "http://127.0.0.1:3001" },
  });
  expect(response.ok()).toBeTruthy();
  await page.reload();
  await page
    .getByRole("searchbox", { name: "Buscar assinatura" })
    .fill("Figma");
  await expect(page.locator(".subscription-row")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Buscar assinatura" }).fill("");
  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(desktop.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await page.getByRole("button", { name: "Assinaturas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Assinaturas", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar assinatura", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("extrato Inter: revisão parcial, inclusão, falha ao salvar e persistência", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.locator("input[type=file]");
  await input.setInputFiles("tests/fixtures/inter-account.csv");
  await expect(
    dialog.getByRole("heading", { name: "Confira a leitura." }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Extrato de conta · padrão Inter · UTF-8"),
  ).toBeVisible();
  await expect(dialog.getByLabel("Conta de origem")).toHaveValue(
    "Inter · Conta",
  );
  expect(
    (await (await page.request.get("/api/workspace")).json()).transactions,
  ).toHaveLength(0);
  await mkdir(".impeccable/review/imports", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".impeccable/review/imports/mapping-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/imports/mapping-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  const save = dialog.getByRole("button", {
    name: "Importar 7 movimentos",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await expect(dialog.getByText("R$ 110,20", { exact: true })).toBeVisible();
  await expect(dialog.getByText("R$ 1.264,46", { exact: true })).toBeVisible();
  await dialog.getByLabel("Incluir linha 6", { exact: true }).uncheck();
  await expect(
    dialog.getByRole("button", { name: "Importar 6 movimentos", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel(/Importar somente as 6 linhas válidas/).check();
  await expect(
    dialog.getByRole("button", { name: "Importar 6 movimentos", exact: true }),
  ).toBeEnabled();
  await dialog.locator(".import-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".impeccable/review/imports/review-desktop.png",
    fullPage: true,
  });
  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(desktop.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.locator(".import-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".impeccable/review/imports/review-mobile.png",
    fullPage: true,
  });
  const mobile = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(mobile.violations).toEqual([]);
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Falha de gravação de teste" }),
    });
  });
  await dialog
    .getByRole("button", { name: "Importar 6 movimentos", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Sua revisão foi mantida",
  );
  await expect(
    dialog.getByRole("heading", { name: "Tudo no lugar?" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Importar 6 movimentos", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/workspace");
  await dialog
    .getByRole("button", { name: "Importar 6 movimentos", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Extrato importado", exact: true }),
  ).toBeVisible();
  const saved = await (await page.request.get("/api/workspace")).json();
  expect(saved.transactions).toHaveLength(6);
  expect(
    saved.transactions.find((t: { kind: string }) => t.kind === "income")
      .amount,
  ).toBe("1234.56");
  expect(
    saved.transactions.some((t: { description: string }) =>
      t.description.includes("PESSOA FICTÍCIA"),
    ),
  ).toBe(false);
  await dialog
    .getByRole("button", { name: "Ver movimentos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Movimentos", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(
    (await (await page.request.get("/api/workspace")).json()).transactions,
  ).toHaveLength(6);
});

test("troca inválida remove prévia antiga, corrige leitura e pagina todas as linhas", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  const trigger = page.getByRole("button", {
    name: "Importar CSV",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const input = dialog.locator("input[type=file]");
  await input.setInputFiles("tests/fixtures/inter-account.csv");
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  await input.setInputFiles({
    name: "extrato.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("%PDF-not-a-csv"),
  });
  await expect(dialog.getByRole("alert")).toContainText("não é um CSV");
  await expect(
    dialog.getByRole("button", { name: /^Importar \d/ }),
  ).toHaveCount(0);
  const text =
    "Data;Descrição;Valor\n" +
    Array.from({ length: 75 }, (_, i) => `01/10/2026;Serviço ${i};-19,90`).join(
      "\n",
    );
  await input.setInputFiles({
    name: "75-linhas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(text),
  });
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  await expect(
    dialog.getByLabel("Incluir linha 51", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Incluir linha 52", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Incluir linha 76", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("searchbox", { name: "Buscar no extrato" })
    .fill("Serviço 74");
  await expect(dialog.locator(".import-ledger-row")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("seleções concorrentes mantêm o arquivo mais recente e CSV fatal bloqueia confirmação", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (this.name === "lento.csv")
        await new Promise((resolve) => setTimeout(resolve, 500));
      return original.call(this);
    };
  });
  const dialog = page.getByRole("dialog"),
    input = dialog.locator("input[type=file]");
  const source = "Data;Descrição;Valor\n01/10/2026;Teste;-10";
  await input.setInputFiles({
    name: "lento.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(source),
  });
  await input.setInputFiles({
    name: "atual.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(source),
  });
  await expect(dialog.getByText("atual.csv", { exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  await expect(dialog.getByText("atual.csv", { exact: true })).toBeVisible();
  await expect(dialog.getByText("lento.csv", { exact: true })).toHaveCount(0);
  await input.setInputFiles({
    name: "quebrado.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      'Data;Descrição;Valor\n01/10/2026;Teste;-10\n02/10/2026;"Sem fechar;-20',
    ),
  });
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  await expect(
    dialog.getByText("A estrutura do arquivo precisa de correção"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Importar 1 movimentos", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByLabel(/Importar somente/)).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/workspace")).json()).transactions,
  ).toHaveLength(0);
});
