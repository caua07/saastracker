import { auth, localAuthEnabled } from "@/server/auth";
import { sameOrigin, jsonError } from "@/server/http";

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (
    !localAuthEnabled() ||
    !["localhost", "127.0.0.1", "[::1]"].includes(host)
  )
    return jsonError("Não encontrado.", 404);
  if (!sameOrigin(request)) return jsonError("Origem inválida.", 403);
  return auth().api.signInEmail({
    body: {
      email: process.env.OWNER_EMAIL!,
      password: process.env.LOCAL_OWNER_PASSWORD!,
    },
    headers: request.headers,
    asResponse: true,
  });
}
