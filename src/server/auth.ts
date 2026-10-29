import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { eq } from "drizzle-orm";

export function localAuthEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_DEV_AUTH === "true" &&
    !!process.env.LOCAL_OWNER_PASSWORD
  );
}
export function authReady() {
  return !!(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.OWNER_EMAIL
  );
}
let instance: ReturnType<typeof betterAuth> | undefined;
export function auth() {
  if (instance) return instance;
  if (!authReady()) throw new Error("Autenticação não configurada.");
  const ownerEmail = process.env.OWNER_EMAIL!.toLowerCase();
  instance = betterAuth<BetterAuthOptions>({
    appName: "Saastemics",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    // Let our route boundary return JSON and sanitize database exceptions.
    onAPIError: { throw: true },
    logger: {
      level: "warn",
      log: (level) => {
        if (level === "warn" || level === "error")
          console.warn("auth_library_event", { level });
      },
    },
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: localAuthEnabled(),
      disableSignUp: true,
      minPasswordLength: 16,
    },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              mapProfileToUser: async (profile) => {
                if (
                  profile.email?.toLowerCase() !== ownerEmail ||
                  !profile.email_verified ||
                  (process.env.OWNER_GOOGLE_SUB &&
                    profile.sub !== process.env.OWNER_GOOGLE_SUB)
                )
                  throw new APIError("FORBIDDEN", {
                    message: "Esta ferramenta é privada.",
                  });
                return { email: profile.email, emailVerified: true };
              },
            },
          }
        : {},
    account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    databaseHooks: {
      account: {
        create: {
          before: async (value) => ({ data: { ...value, idToken: null } }),
        },
        update: {
          before: async (value) => ({ data: { ...value, idToken: null } }),
        },
      },
      user: {
        create: {
          before: async (value) => {
            if (
              value.email.toLowerCase() !== ownerEmail ||
              !value.emailVerified
            )
              throw new APIError("FORBIDDEN", {
                message: "Esta ferramenta é privada.",
              });
            return { data: value };
          },
        },
      },
      session: {
        create: {
          before: async (value) => {
            const [u] = await db()
              .select()
              .from(schema.user)
              .where(eq(schema.user.id, value.userId));
            if (!u || u.email.toLowerCase() !== ownerEmail || !u.emailVerified)
              throw new APIError("FORBIDDEN", {
                message: "Acesso não autorizado.",
              });
            return { data: value };
          },
        },
      },
    },
  });
  return instance;
}
export async function currentOwner() {
  if (!authReady()) return null;
  const result = await auth().api.getSession({ headers: await headers() });
  if (
    !result ||
    result.user.email.toLowerCase() !==
      process.env.OWNER_EMAIL!.toLowerCase() ||
    !result.user.emailVerified
  )
    return null;
  return result.user;
}
