import { Tracker, type View } from "@/components/tracker";
import { demoWorkspace } from "@/domain/demo";
export const dynamic = "force-dynamic";
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
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
      initialData={demoWorkspace()}
      initialView={allowed.includes(view ?? "") ? (view as View) : "overview"}
      demo
    />
  );
}
