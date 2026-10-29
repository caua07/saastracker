import { currentOwner } from "@/server/auth";
import { sameOrigin, jsonError } from "@/server/http";
import {
  pluggyConfigured,
  syncPluggy,
  BankError,
} from "@/server/integrations/pluggy";
import { ConflictError } from "@/server/workspace";
import { z } from "zod";
export const maxDuration = 30;
export async function GET() {
  if (!(await currentOwner()))
    return jsonError("Entre para consultar as conexões.", 401);
  return Response.json(
    { configured: pluggyConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Origem inválida.", 403);
  const owner = await currentOwner();
  if (!owner) return jsonError("Entre para conectar sua fonte.", 401);
  const input = z
    .object({ itemId: z.uuid() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Informe um Item ID válido.");
  try {
    return Response.json({
      message: await syncPluggy(owner.id, input.data.itemId),
    });
  } catch (error) {
    if (error instanceof BankError) return jsonError(error.message);
    if (error instanceof ConflictError) return jsonError(error.message, 409);
    console.error("pluggy_sync_failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return jsonError(
      "A consulta não foi concluída. O progresso e seu histórico foram preservados; tente novamente.",
      502,
    );
  }
}
