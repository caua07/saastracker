import { toNextJsHandler } from "better-auth/next-js";
import { auth, authReady } from "@/server/auth";
export async function GET(request: Request) {
  if (!authReady())
    return Response.json(
      { error: "Autenticação não configurada." },
      { status: 503 },
    );
  return toNextJsHandler(auth()).GET(request);
}
export async function POST(request: Request) {
  if (!authReady())
    return Response.json(
      { error: "Autenticação não configurada." },
      { status: 503 },
    );
  return toNextJsHandler(auth()).POST(request);
}
