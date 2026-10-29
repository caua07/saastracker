import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { backupSchema, type Workspace } from "@/domain/model";

const bucket = "assets";
const limit = 10 * 1024 * 1024;
let client: S3Client | undefined;

export function storageConfigured() {
  return [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ENDPOINT_URL_S3",
    "AWS_REGION",
  ].every((key) => !!process.env[key]);
}
function storage() {
  if (!storageConfigured()) throw new Error("Storage não configurado.");
  return (client ??= new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
  }));
}
function object(ownerId: string) {
  return {
    Bucket: bucket,
    Key: `owners/${encodeURIComponent(ownerId)}/backup.json`,
  };
}
export async function saveCloudBackup(ownerId: string, workspace: Workspace) {
  const backup = backupSchema.parse({
    format: "saastemics",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: workspace,
  });
  const body = JSON.stringify(backup);
  if (Buffer.byteLength(body) > limit)
    throw new Error("Backup acima de 10 MB.");
  await storage().send(
    new PutObjectCommand({
      ...object(ownerId),
      Body: body,
      ContentType: "application/json",
      CacheControl: "no-store",
    }),
    { abortSignal: AbortSignal.timeout(15000) },
  );
  return { exportedAt: backup.exportedAt, version: backup.data.version };
}
export async function readCloudBackup(ownerId: string) {
  try {
    const result = await storage().send(new GetObjectCommand(object(ownerId)), {
      abortSignal: AbortSignal.timeout(15000),
    });
    if (!result.Body) throw new Error("Backup sem conteúdo.");
    if (!result.ContentLength || result.ContentLength > limit)
      throw new Error("Tamanho de backup inválido.");
    const content = await result.Body.transformToString();
    if (Buffer.byteLength(content) > limit)
      throw new Error("Backup acima de 10 MB.");
    return backupSchema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") return null;
    throw error;
  }
}
export async function deleteCloudBackup(ownerId: string) {
  await storage().send(new DeleteObjectCommand(object(ownerId)), {
    abortSignal: AbortSignal.timeout(15000),
  });
}
