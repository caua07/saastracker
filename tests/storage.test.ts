import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { emptyWorkspace } from "@/domain/model";
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  GetObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));
import {
  storageConfigured,
  saveCloudBackup,
  readCloudBackup,
  deleteCloudBackup,
} from "@/server/storage";

beforeEach(() => {
  send.mockReset();
  for (const key of [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ENDPOINT_URL_S3",
    "AWS_REGION",
  ])
    vi.stubEnv(key, "test-only");
});
afterAll(() => vi.unstubAllEnvs());

describe("backup privado na nuvem", () => {
  it("só habilita armazenamento com todas as variáveis", () => {
    expect(storageConfigured()).toBe(true);
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    expect(storageConfigured()).toBe(false);
  });
  it("salva somente o workspace validado no caminho do proprietário", async () => {
    send.mockResolvedValue({});
    await saveCloudBackup("owner/one", emptyWorkspace());
    const { input } = send.mock.calls[0][0];
    expect(input.Key).toBe("owners/owner%2Fone/backup.json");
    expect(input.Bucket).toBe("assets");
    expect(input.CacheControl).toBe("no-store");
    const backup = JSON.parse(input.Body);
    expect(backup.data).toEqual(emptyWorkspace());
    expect(backup.schemaVersion).toBe(1);
    expect(input.Body).not.toContain("test-only");
  });
  it("ausência de cópia é diferente de falha de acesso", async () => {
    send.mockRejectedValueOnce(
      Object.assign(new Error(), { name: "NoSuchKey" }),
    );
    expect(await readCloudBackup("one")).toBeNull();
    send.mockRejectedValueOnce(
      Object.assign(new Error(), { name: "AccessDenied" }),
    );
    await expect(readCloudBackup("one")).rejects.toThrow();
  });
  it("valida o formato baixado e limita o tamanho antes de ler", async () => {
    const body = {
      transformToString: vi.fn().mockResolvedValue('{"schemaVersion":99}'),
    };
    send.mockResolvedValue({ ContentLength: 10, Body: body });
    await expect(readCloudBackup("one")).rejects.toThrow();
    body.transformToString.mockClear();
    send.mockResolvedValue({ ContentLength: 11 * 1024 * 1024, Body: body });
    await expect(readCloudBackup("one")).rejects.toThrow();
    expect(body.transformToString).not.toHaveBeenCalled();
  });
  it("exclusão só aponta para a cópia daquele proprietário", async () => {
    send.mockResolvedValue({});
    await deleteCloudBackup("two");
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "assets",
      Key: "owners/two/backup.json",
    });
  });
});
