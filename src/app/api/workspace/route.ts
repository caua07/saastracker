import { currentOwner } from "@/server/auth";
import {
  loadWorkspace,
  saveWorkspace,
  ConflictError,
} from "@/server/workspace";
import { workspaceSchema } from "@/domain/model";
import { jsonError, sameOrigin } from "@/server/http";

export async function GET() {
  const owner = await currentOwner();
  if (!owner) return jsonError("Entre para acessar seus dados.", 401);
  return Response.json(await loadWorkspace(owner.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return jsonError("Origem inválida.", 403);
  const owner = await currentOwner();
  if (!owner) return jsonError("Entre para salvar seus dados.", 401);
  if (Number(request.headers.get("content-length") ?? 0) > 10 * 1024 * 1024)
    return jsonError("Dados acima do limite de 10 MB.", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    return jsonError("Dados acima do limite de 10 MB.", 413);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return jsonError("Arquivo JSON inválido.");
  }
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  try {
    return Response.json({
      version: await saveWorkspace(owner.id, parsed.data, {
        resetConnections: request.headers.get("x-reset-connections") === "true",
      }),
    });
  } catch (error) {
    if (error instanceof ConflictError) return jsonError(error.message, 409);
    console.error("workspace_save_failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return jsonError(
      "Não foi possível salvar. Seus dados anteriores foram preservados.",
      500,
    );
  }
}
