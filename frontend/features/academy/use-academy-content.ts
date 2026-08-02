"use client";

import { useQuery } from "@tanstack/react-query";
import { academyApi } from "@/lib/api-client";
import type {
  AcademyModule,
  AcademyPathDetail,
  AcademyQuiz,
  AcademyQuizQuestion,
  DemoLesson,
  GlossaryDefinition,
  LearningPathSummary,
  LocalizedText,
  ReviewCardDefinition,
} from "@/lib/academy-types";
import { DEMO_LESSON, DEMO_MODULES, DEMO_PATHS, DEMO_QUIZ } from "@/lib/demo-academy";

type BackendPath = {
  id: string;
  title: Record<"de" | "sl" | "en", string>;
  summary: Record<"de" | "sl" | "en", string>;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_minutes?: number;
  lesson_count?: number;
  status?: "active" | "coming_next";
  preview_topics?: Record<"de" | "sl" | "en", string[]>;
  prerequisite_path_ids?: string[];
  completion_criteria?: Record<string, number> | null;
  final_assessment_id?: string | null;
  modules?: BackendModule[];
  lessons?: BackendLesson[];
};

type BackendModule = {
  id: string;
  path_id: string;
  order: number;
  title: LocalizedText;
  objective?: LocalizedText;
  summary?: LocalizedText;
  lessons?: BackendLesson[];
};

type BackendLesson = {
  id: string;
  path_id: string;
  module_id: string;
  order?: number;
  duration_minutes: number;
  title: LocalizedText;
  summary: LocalizedText;
  objectives: Record<"de" | "sl" | "en", string[]>;
  content: {
    core?: LocalizedText;
    visual?: LocalizedText | { caption?: LocalizedText };
    interactive?: LocalizedText | { prompt?: LocalizedText };
    worked_example?: LocalizedText;
    common_mistake?: LocalizedText;
    takeaway?: LocalizedText;
  };
  knowledge_checks?: string[];
  glossary?: string[];
  sources?: string[];
  resolved_glossary?: BackendGlossary[];
  resolved_sources?: BackendSource[];
  resolved_review_cards?: BackendReviewCard[];
};

type BackendGlossary = { id: string; term: LocalizedText; definition: LocalizedText };
type BackendReviewCard = { id: string; front: LocalizedText; back: LocalizedText };
type BackendSource = { id: string; title: string; publisher?: string; url: string };
type BackendQuiz = { id: string; lesson_id: string; questions: BackendQuestion[] };
type BackendQuestion = {
  id: string;
  lesson_id: string;
  type: AcademyQuizQuestion["type"];
  prompt: LocalizedText;
  options?: Array<{ id: string; text: LocalizedText }>;
  items?: Array<{ id: string; text: LocalizedText }>;
  left_items?: Array<{ id: string; text: LocalizedText }>;
  right_items?: Array<{ id: string; text: LocalizedText }>;
  chart_exercise_id?: string;
  scenario_id?: string;
  review_recommended?: boolean;
};

const EMPTY_TEXT: LocalizedText = { de: "", sl: "", en: "" };

function localizedBlock(value: LocalizedText | { caption?: LocalizedText; prompt?: LocalizedText } | undefined): LocalizedText {
  if (!value) return EMPTY_TEXT;
  if ("de" in value) return value;
  return value.caption ?? value.prompt ?? EMPTY_TEXT;
}

export function lessonFromBackend(lesson: BackendLesson): DemoLesson {
  return {
    id: lesson.id,
    pathId: lesson.path_id,
    moduleId: lesson.module_id,
    title: lesson.title,
    summary: lesson.summary,
    durationMinutes: lesson.duration_minutes,
    objectives: lesson.objectives,
    sections: {
      core: lesson.content.core ?? EMPTY_TEXT,
      visual: localizedBlock(lesson.content.visual),
      exercise: localizedBlock(lesson.content.interactive),
      worked: lesson.content.worked_example ?? EMPTY_TEXT,
      mistake: lesson.content.common_mistake ?? EMPTY_TEXT,
      takeaway: lesson.content.takeaway ?? EMPTY_TEXT,
    },
    glossaryIds: lesson.glossary ?? [],
    sourceIds: lesson.sources ?? [],
    knowledgeCheckIds: lesson.knowledge_checks ?? [],
    resolvedGlossary: lesson.resolved_glossary?.map((item): GlossaryDefinition => item),
    resolvedSources: lesson.resolved_sources?.map((item) => ({ id: item.id, title: item.title, publisher: item.publisher ?? "", url: item.url })),
    resolvedReviewCards: lesson.resolved_review_cards?.map((item): ReviewCardDefinition => item),
  };
}

function moduleFromBackend(module: BackendModule): AcademyModule {
  return {
    id: module.id,
    pathId: module.path_id,
    order: module.order,
    title: module.title,
    summary: module.summary ?? module.objective ?? EMPTY_TEXT,
    lessonIds: (module.lessons ?? []).map((lesson) => lesson.id),
  };
}

function pathFromBackend(path: BackendPath): LearningPathSummary {
  return {
    id: path.id,
    title: path.title,
    summary: path.summary,
    difficulty: path.difficulty,
    estimatedMinutes: path.estimated_minutes ?? 0,
    lessonCount: path.lesson_count ?? 0,
    status: path.status ?? "active",
    previewTopics: path.preview_topics ?? { de: [], sl: [], en: [] },
  };
}

export function pathDetailFromBackend(path: BackendPath): AcademyPathDetail {
  const summary = pathFromBackend(path);
  const lessons = (path.lessons ?? []).map(lessonFromBackend);
  const modules = (path.modules ?? []).map(moduleFromBackend);
  return {
    ...summary,
    lessonCount: summary.lessonCount || lessons.length,
    prerequisitePathIds: path.prerequisite_path_ids ?? [],
    completionCriteria: path.completion_criteria ?? null,
    finalAssessmentId: path.final_assessment_id ?? null,
    modules,
    lessons,
  };
}

export function quizFromBackend(quiz: BackendQuiz): AcademyQuiz {
  return {
    id: quiz.id,
    lessonId: quiz.lesson_id,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      lessonId: question.lesson_id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      items: question.items,
      leftItems: question.left_items,
      rightItems: question.right_items,
      chartExerciseId: question.chart_exercise_id,
      scenarioId: question.scenario_id,
      reviewRecommended: question.review_recommended,
    })),
  };
}

export function useLearningPaths() {
  const query = useQuery({
    queryKey: ["academy", "learning-paths"],
    queryFn: async () => {
      const response = await academyApi<BackendPath[] | { items: BackendPath[] }>("/learning-paths");
      return (Array.isArray(response) ? response : response.items).map(pathFromBackend);
    },
    retry: 1,
  });
  return { ...query, paths: query.data?.length ? query.data : DEMO_PATHS, usingFallback: !query.data };
}

export function useLesson(lessonId: string) {
  const query = useQuery({
    queryKey: ["academy", "lesson", lessonId],
    queryFn: async () => lessonFromBackend(await academyApi<BackendLesson>(`/lessons/${lessonId}`)),
    retry: 1,
  });
  return { ...query, lesson: query.data ?? (lessonId === DEMO_LESSON.id ? DEMO_LESSON : null), usingFallback: !query.data };
}

export function useLearningPath(pathId: string) {
  const query = useQuery({
    queryKey: ["academy", "learning-path", pathId],
    queryFn: async () => pathDetailFromBackend(await academyApi<BackendPath>(`/learning-paths/${pathId}`)),
    retry: 1,
  });
  const fallbackPath = DEMO_PATHS.find((path) => path.id === pathId);
  const fallback: AcademyPathDetail | null = fallbackPath
    ? {
        ...fallbackPath,
        prerequisitePathIds: [],
        completionCriteria: fallbackPath.status === "active" ? { required_lessons: fallbackPath.lessonCount } : null,
        finalAssessmentId: null,
        modules: pathId === "path-finance-foundations" ? DEMO_MODULES : [],
        lessons: pathId === "path-finance-foundations" ? [DEMO_LESSON] : [],
      }
    : null;
  return { ...query, path: query.data ?? fallback, usingFallback: !query.data };
}

export function useQuiz(quizId: string) {
  const query = useQuery({
    queryKey: ["academy", "quiz", quizId],
    queryFn: async () => quizFromBackend(await academyApi<BackendQuiz>(`/quizzes/${quizId}`)),
    retry: 1,
  });
  const fallback: AcademyQuiz | null = quizId === DEMO_LESSON.id || quizId === "quiz-ff-finance-map"
    ? {
        id: quizId,
        lessonId: DEMO_LESSON.id,
        questions: DEMO_QUIZ.map((question) => ({
          id: question.id,
          lessonId: DEMO_LESSON.id,
          type: "single_choice",
          prompt: question.prompt,
          options: question.options.map((option) => ({ id: option.id, text: option.label })),
          reviewRecommended: true,
        })),
      }
    : null;
  return { ...query, quiz: query.data ?? fallback, usingFallback: !query.data };
}
