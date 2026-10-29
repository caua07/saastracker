import "server-only";
const safeCodes = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "28P01",
  "42501",
  "42P01",
  "42703",
]);
export function authFailureResponse(error?: unknown) {
  let cause = error;
  let code = "AUTH_SERVER_ERROR";
  for (
    let depth = 0;
    cause && typeof cause === "object" && depth < 6;
    depth++
  ) {
    if (
      "code" in cause &&
      typeof cause.code === "string" &&
      safeCodes.has(cause.code)
    ) {
      code = cause.code;
      break;
    }
    cause = "cause" in cause ? cause.cause : undefined;
  }
  // Never log the error object: SQL exceptions can contain OAuth state and tokens.
  console.error("auth_request_failed", { code });
  return Response.json(
    {
      error:
        "O servidor de login está indisponível. Confira a configuração do banco e tente novamente.",
      code: "AUTH_SERVER_ERROR",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
