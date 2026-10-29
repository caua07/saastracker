import { redirect } from "next/navigation";
import { currentOwner } from "@/server/auth";
import { loadWorkspace } from "@/server/workspace";
import { Tracker, type View } from "@/components/tracker";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const { view } = await searchParams;
  const allowed = [
    "overview",
    "subscriptions",
    "calendar",
    "discovery",
    "connections",
    "transactions",
  ];
  return (
    <Tracker
      initialData={await loadWorkspace(owner.id)}
      initialView={allowed.includes(view ?? "") ? (view as View) : "overview"}
      ownerName={owner.name}
    />
  );
}
