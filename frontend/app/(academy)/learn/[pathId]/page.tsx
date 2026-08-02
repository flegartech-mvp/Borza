import { PathOverview } from "@/features/academy/path-overview";
export default async function Page({
  params,
}: {
  params: Promise<{ pathId: string }>;
}) {
  const { pathId } = await params;
  return <PathOverview pathId={pathId} />;
}
