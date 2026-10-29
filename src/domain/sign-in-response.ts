export async function readSignInResponse(
  response: Response,
  redirectRequired: boolean,
): Promise<{ url?: string }> {
  if (response.status >= 500)
    throw new Error(
      "O servidor de login está indisponível. Confira a configuração do banco e tente novamente.",
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      "O login recebeu uma resposta inválida. Atualize a página e tente novamente.",
    );
  }
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (!response.ok) {
    if (data.code === "INVALID_ORIGIN" || data.code === "INVALID_CALLBACK_URL")
      throw new Error(
        "O endereço do app não está autorizado para login. Abra o endereço principal e tente novamente.",
      );
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : "Não foi possível entrar. Tente novamente.";
    throw new Error(message.slice(0, 300));
  }
  if (typeof data.url === "string") {
    let url: URL;
    try {
      url = new URL(data.url);
    } catch {
      throw new Error("O login não retornou um endereço válido.");
    }
    if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
      throw new Error("O login não retornou um endereço válido do Google.");
    return { url: url.href };
  }
  if (redirectRequired || !value || typeof value !== "object")
    throw new Error(
      "Não foi possível iniciar o login Google. Atualize a página e tente novamente.",
    );
  return {};
}
