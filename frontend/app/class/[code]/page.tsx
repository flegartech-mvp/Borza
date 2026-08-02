import { ClassroomJoin } from "@/features/practical-finance/classroom-join";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ClassroomJoin initialCode={code} />;
}
