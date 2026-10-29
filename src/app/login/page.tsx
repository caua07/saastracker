import { redirect } from "next/navigation";
import { authReady, currentOwner, localAuthEnabled } from "@/server/auth";
import { Login } from "@/components/login";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const owner = await currentOwner();
  if (owner) redirect("/");
  return (
    <Login
      googleReady={
        authReady() &&
        !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      }
      localReady={localAuthEnabled() && authReady()}
      configured={authReady()}
      error={!!(await searchParams).error}
    />
  );
}
