import { ModuleOverview } from "@/features/academy/path-overview";
export default async function Page({ params }: { params: Promise<{ pathId: string; moduleId: string }> }) { const { pathId, moduleId } = await params; return <ModuleOverview pathId={pathId} moduleId={moduleId} />; }
