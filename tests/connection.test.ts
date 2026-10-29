import { describe, expect, it } from "vitest";
import { databaseConnectionString } from "@/server/db/connection";
describe("conexão Postgres", () => {
  it("mantém verificação completa de certificado e channel binding no Neon", () => {
    const url = new URL(
      databaseConnectionString(
        "postgresql://test:example@ep-test-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      ),
    );
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.hostname).toContain("-pooler");
  });
  it("preserva conexão local e configuração explícita de TLS", () => {
    expect(
      databaseConnectionString("postgresql://test@127.0.0.1:55432/test"),
    ).toBe("postgresql://test@127.0.0.1:55432/test");
    expect(
      new URL(
        databaseConnectionString(
          "postgresql://test@ep-test.us-east-2.aws.neon.tech/test?sslmode=verify-full",
        ),
      ).searchParams.get("sslmode"),
    ).toBe("verify-full");
  });
});
