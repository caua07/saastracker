import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { handler, ready } = vi.hoisted(() => ({
  handler: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  authReady: ready,
  auth: () => ({ handler }),
}));
import { POST } from "@/app/api/auth/[...all]/route";
const request = () =>
  new Request("https://app.example/api/auth/sign-in/social", {
    method: "POST",
  });
beforeEach(() => {
  vi.clearAllMocks();
  ready.mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());
describe("limite de erro da autenticação", () => {
  it("configuração incompleta retorna JSON 503", async () => {
    ready.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty("error");
    expect(handler).not.toHaveBeenCalled();
  });
  it("exceção de banco não imprime parâmetros ou tokens", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    handler.mockRejectedValue(
      Object.assign(new Error("secret SQL params"), {
        params: ["oauth-secret"],
        cause: { code: "ENOTFOUND" },
      }),
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("secret");
    expect(log).toHaveBeenCalledWith("auth_request_failed", {
      code: "ENOTFOUND",
    });
  });
  it("normaliza erro vazio do framework e preserva sucesso/cookies", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    handler.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect(await (await POST(request())).json()).toHaveProperty(
      "code",
      "AUTH_SERVER_ERROR",
    );
    const original = Response.json(
      { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      { headers: { "set-cookie": "state=test; HttpOnly; Secure" } },
    );
    handler.mockResolvedValueOnce(original);
    expect(await POST(request())).toBe(original);
  });
});
