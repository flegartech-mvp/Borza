import { LessonPage } from "@/features/academy/lesson-page";
export default async function Page({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  return <LessonPage lessonId={lessonId} />;
}
