import { describe, it, expect } from "vitest";
import { validatedNext } from "@/server/integrations/pluggy";
import { workspaceSchema, backupSchema } from "@/domain/model";
import { demoWorkspace } from "@/domain/demo";
describe("limites de confiança", () => {
  it("recusa URL de paginação em outro host/caminho/conta", () => {
    expect(() =>
      validatedNext("https://169.254.169.254/?accountId=a&after=b", "a"),
    ).toThrow();
    expect(() => validatedNext("/items?accountId=a&after=b", "a")).toThrow();
    expect(() => validatedNext("?accountId=other&after=b", "a")).toThrow();
    expect(validatedNext("?accountId=a&after=b", "a")).toBe(
      "/v2/transactions?accountId=a&after=b",
    );
  });
  it("backup exige versão e não aceita campos de credencial", () => {
    const data = demoWorkspace();
    expect(
      backupSchema.safeParse({
        format: "saastemics",
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        data,
      }).success,
    ).toBe(false);
    expect(
      workspaceSchema.safeParse({ ...data, apiKey: "secret" }).success,
    ).toBe(false);
  });
  it("não aceita link javascript nem IDs repetidos", () => {
    const data = demoWorkspace();
    data.subscriptions[0].website = "javascript:alert(1)";
    expect(workspaceSchema.safeParse(data).success).toBe(false);
    const duplicate = demoWorkspace();
    duplicate.subscriptions.push(duplicate.subscriptions[0]);
    expect(workspaceSchema.safeParse(duplicate).success).toBe(false);
  });
});
