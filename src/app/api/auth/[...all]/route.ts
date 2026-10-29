import { toNextJsHandler } from "better-auth/next-js";
import { auth, authReady } from "@/server/auth";
import { authFailureResponse } from "@/server/auth-error";
export const runtime = "nodejs";
async function handle(request: Request) {
  if (!authReady())
    return Response.json(
      { error: "Autenticação não configurada." },
      { status: 503 },
    );
  try {
    const handlers = toNextJsHandler(auth());
    const response = await (request.method === "GET"
      ? handlers.GET(request)
      : handlers.POST(request));
    return response.status >= 500 ? authFailureResponse() : response;
  } catch (error) {
    return authFailureResponse(error);
  }
}
export { handle as GET, handle as POST };
