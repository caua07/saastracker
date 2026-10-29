import { describe, expect, it } from "vitest";
import { readSignInResponse } from "@/domain/sign-in-response";
describe("resposta de login", () => {
  it.each([
    "",
    "<html>upstream failure</html>",
    '{"message":"secret SQL parameters"}',
  ])("falha 500 é legível mesmo sem JSON", async (body) => {
    await expect(
      readSignInResponse(new Response(body, { status: 500 }), true),
    ).rejects.toThrow("servidor de login");
  });
  it("aceita redirecionamento Google e login local", async () => {
    expect(
      await readSignInResponse(
        Response.json({
          url: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
        }),
        true,
      ),
    ).toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
    });
    expect(
      await readSignInResponse(Response.json({ user: { id: "test" } }), false),
    ).toEqual({});
  });
  it("rejeita resposta vazia ou sucesso sem URL de OAuth", async () => {
    await expect(readSignInResponse(new Response(""), true)).rejects.toThrow(
      "resposta inválida",
    );
    await expect(readSignInResponse(Response.json({}), true)).rejects.toThrow(
      "iniciar o login",
    );
  });
  it("recusa URL de script e explica erro de origem", async () => {
    await expect(
      readSignInResponse(Response.json({ url: "javascript:alert(1)" }), true),
    ).rejects.toThrow("endereço válido do Google");
    await expect(
      readSignInResponse(
        Response.json({ code: "INVALID_ORIGIN" }, { status: 403 }),
        true,
      ),
    ).rejects.toThrow("endereço do app");
  });
});
