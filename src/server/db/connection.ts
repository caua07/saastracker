// Keep Neon's current full certificate verification explicit across pg upgrades.
export function databaseConnectionString(value: string) {
  const url = new URL(value);
  if (
    url.hostname.endsWith(".neon.tech") &&
    url.searchParams.get("sslmode") === "require"
  )
    url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
