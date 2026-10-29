import { currentOwner } from "@/server/auth";
import { jsonError, sameOrigin } from "@/server/http";
import { loadWorkspace } from "@/server/workspace";
import {
  storageConfigured,
  saveCloudBackup,
  readCloudBackup,
  deleteCloudBackup,
} from "@/server/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const owner = await currentOwner();
  if (!owner) return jsonError("Entre para acessar seu backup.", 401);
  if (!storageConfigured())
    return jsonError("O backup na nuvem ainda não foi configurado.", 503);
  try {
    const backup = await readCloudBackup(owner.id);
    if (!backup)
      return jsonError("Você ainda não salvou uma cópia na nuvem.", 404);
    return Response.json(backup, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="saastemics-cloud.json"',
      },
    });
  } catch {
    console.error("cloud_backup_read_failed");
    return jsonError("Não foi possível baixar a cópia. Tente novamente.", 502);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Origem inválida.", 403);
  const owner = await currentOwner();
  if (!owner) return jsonError("Entre para salvar seu backup.", 401);
  if (!storageConfigured())
    return jsonError("O backup na nuvem ainda não foi configurado.", 503);
  try {
    const workspace = await loadWorkspace(owner.id);
    return Response.json(await saveCloudBackup(owner.id, workspace), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("cloud_backup_save_failed");
    return jsonError(
      "Não foi possível salvar a cópia. Seus dados no app foram preservados.",
      502,
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return jsonError("Origem inválida.", 403);
  const owner = await currentOwner();
  if (!owner) return jsonError("Entre para excluir seu backup.", 401);
  if (!storageConfigured())
    return jsonError("O backup na nuvem ainda não foi configurado.", 503);
  try {
    await deleteCloudBackup(owner.id);
    return Response.json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("cloud_backup_delete_failed");
    return jsonError("Não foi possível excluir a cópia. Tente novamente.", 502);
  }
}
