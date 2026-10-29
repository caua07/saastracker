import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db/client";
import { bankSyncs } from "@/server/db/schema";
import { syncPluggy } from "@/server/integrations/pluggy";
export const maxDuration = 30;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    header.length !== expected.length ||
    !timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  )
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  const connections = await db().select().from(bankSyncs).limit(1);
  let processed = 0;
  for (const connection of connections) {
    try {
      await syncPluggy(connection.ownerId, connection.itemId);
      processed++;
    } catch {
      console.error("scheduled_sync_incomplete");
    }
  }
  return Response.json(
    { processed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
