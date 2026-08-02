import { QuizPage } from "@/features/academy/quiz-page";
export default async function Page({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  return <QuizPage quizId={quizId} />;
}
