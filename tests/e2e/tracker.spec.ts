import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { emptyWorkspace } from "../../src/domain/model";
import { readFile, mkdir } from "node:fs/promises";
import { sampleWorkspace } from "../support/workspace";
import { nextScheduledDate } from "../../src/domain/discovery/schedule";
import { dateLabel, today } from "../../src/domain/finance";

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

test("Descoberta mostra Spotify isolado como possível e recusa falsos padrões de compras", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page.getByRole("button", { name: "Conexões", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  const csv = [
    "Data;Histórico;Descrição;Valor;Saldo",
    "29/09/2026;Compra no débito;Loja de exemplo;-35,00;1000,00",
    "01/10/2026;Compra no débito;SPOTIFY;-29,90;970,10",
    "08/10/2026;Compra no débito;Café de exemplo;-20,00;950,10",
    "21/10/2026;Compra no débito;Café de exemplo;-20,00;930,10",
    "27/10/2026;Compra no débito;Loja de exemplo;-85,00;845,10",
    "28/10/2026;Pagamento de fatura;Cartão de exemplo;-400,00;445,10",
  ].join("\n");
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "conta-sintetica.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: "Conferir prévia" }).click();
  await page
    .getByRole("button", { name: "Importar 6 movimentos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Extrato importado", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar assinaturas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Descoberta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Padrões recorrentes 0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Possíveis assinaturas 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("6 movimentos · janela observada de 30 dias"),
  ).toBeVisible();
  await expect(
    page.getByText(/Esse total não revela os serviços pagos no cartão/),
  ).toBeVisible();
  const candidate = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Spotify", exact: true }),
  });
  await expect(candidate).toHaveCount(1);
  await expect(candidate).toContainText("última cobrança encontrada");
  await expect(candidate).toContainText("Frequência a confirmar");
  await expect(candidate).not.toContainText("Mensal");
  await expect(page.locator(".candidate")).toHaveCount(1);
  expect(
    (await (await page.request.get("/api/workspace")).json()).subscriptions,
  ).toHaveLength(0);
  await mkdir(".impeccable/review/discovery", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".impeccable/review/discovery/desktop.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -225, 0)",
  );
  await expect(page.locator(".main-shell")).toHaveCSS("margin-left", "0px");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".impeccable/review/discovery/mobile.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await candidate
    .getByRole("button", { name: "Revisar possível assinatura", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await expect(
    form.getByRole("combobox", { name: "Frequência", exact: true }),
  ).toHaveValue("");
  await expect(
    form.getByLabel("Próxima cobrança", { exact: true }),
  ).toHaveValue("");
  await form
    .getByRole("combobox", { name: "Frequência", exact: true })
    .selectOption("monthly");
  await form.getByLabel("Próxima cobrança", { exact: true }).fill("2026-11-01");
  await form
    .getByRole("button", { name: "Confirmar assinatura", exact: true })
    .click();
  await expect(form).toBeHidden();
  const w = await (await page.request.get("/api/workspace")).json();
  expect(w.subscriptions).toHaveLength(1);
  expect(w.subscriptions[0]).toMatchObject({
    name: "Spotify",
    cycle: "monthly",
    anchorDate: "2026-11-01",
    amount: "29.9",
  });
  expect(
    w.transactions.filter(
      (t: { subscriptionId: string | null }) => !!t.subscriptionId,
    ),
  ).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".candidate")).toHaveCount(0);
});

test("extratos de meses diferentes se cruzam automaticamente e preenchem a data observada", async ({
  page,
}) => {
  await signIn(page);
  await reset(page);
  await page.getByRole("button", { name: "Descoberta", exact: true }).click();
  const files = [
    [
      "09/10/2026;Compra no débito;Clube de leitura;-49,90;1000,00",
      "15/10/2026;Compra no débito;Spotify;-29,90;970,10",
    ],
    ["10/08/2026;Compra no débito;Clube de leitura;-49,90;1000,00"],
    ["11/09/2026;Compra no débito;Clube de leitura;-49,90;1000,00"],
  ];
  for (const [i, lines] of files.entries()) {
    await page
      .getByRole("button", { name: "Importar extrato", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input[type=file]").setInputFiles({
      name: `arquivo-${i}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(
        ["Data;Histórico;Descrição;Valor;Saldo", ...lines].join("\n"),
      ),
    });
    await expect(dialog.getByRole("status")).toContainText(
      "Meses detectados pelas datas:",
    );
    if (i > 0)
      await expect(dialog.getByRole("status")).toContainText("1 mês novo");
    await dialog
      .getByRole("button", { name: "Conferir prévia", exact: true })
      .click();
    await dialog
      .getByRole("button", {
        name: `Importar ${lines.length} movimentos`,
        exact: true,
      })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Extrato importado", exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Revisar assinaturas", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Padrões recorrentes ${i === 2 ? 1 : 0}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.locator(".discovery-history summary").click();
  await expect(page.locator(".discovery-history li")).toHaveCount(3);
  const candidate = page.locator(".candidate").filter({
    has: page.getByRole("heading", { name: "clube de leitura", exact: true }),
  });
  await expect(candidate).toContainText("Por volta do dia 10 de cada mês");
  await expect(
    candidate.locator('.candidate-calendar time[datetime="2026-11-10"]'),
  ).toHaveCount(1);
  await expect(candidate).toContainText(
    "3 meses com cobranças · desvio observado de até 1 dia",
  );
  await expect(
    candidate
      .getByRole("list", { name: "Comparação das datas de cobrança" })
      .locator("time"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Possíveis assinaturas 1", exact: true }),
  ).toBeVisible();
  await mkdir(".impeccable/review/multi-month", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".impeccable/review/multi-month/desktop.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -225, 0)",
  );
  await expect(page.locator(".main-shell")).toHaveCSS("margin-left", "0px");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".impeccable/review/multi-month/mobile.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await candidate
    .getByRole("button", { name: "Confirmar assinatura", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await expect(
    form.getByLabel("Data-base observada", { exact: true }),
  ).toHaveValue("2026-08-10");
  await expect(
    form.getByRole("combobox", { name: "Frequência", exact: true }),
  ).toHaveValue("monthly");
  await expect(form).toContainText(
    dateLabel(nextScheduledDate("2026-08-10", "monthly", today()), true),
  );
  await form
    .getByRole("button", { name: "Confirmar assinatura", exact: true })
    .click();
  await expect(form).toBeHidden();
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(workspace.imports).toHaveLength(3);
  expect(workspace.transactions).toHaveLength(4);
  expect(workspace.subscriptions[0]).toMatchObject({
    cycle: "monthly",
    anchorDate: "2026-08-10",
  });
  expect(
    workspace.transactions.filter(
      (t: { subscriptionId: string | null }) => !!t.subscriptionId,
    ),
  ).toHaveLength(3);
  await page.reload();
  await expect(page.locator(".candidate-calendar")).toHaveCount(0);
  await expect(page.locator(".discovery-history summary")).toContainText(
    "3 meses com movimentos",
  );
});
