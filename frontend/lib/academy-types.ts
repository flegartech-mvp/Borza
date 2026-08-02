import type { Language } from "@/i18n/dictionaries";

export type LocalizedText = Record<Language, string>;

export type LearningPathSummary = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  lessonCount: number;
  status: "active" | "coming_next";
  previewTopics: Record<Language, string[]>;
};

export type AcademyModule = {
  id: string;
  pathId: string;
  order: number;
  title: LocalizedText;
  summary: LocalizedText;
  lessonIds: string[];
};

export type DemoLesson = {
  id: string;
  pathId: string;
  moduleId: string;
  title: LocalizedText;
  summary: LocalizedText;
  durationMinutes: number;
  objectives: Record<Language, string[]>;
  sections: {
    core: LocalizedText;
    visual: LocalizedText;
    exercise: LocalizedText;
    worked: LocalizedText;
    mistake: LocalizedText;
    takeaway: LocalizedText;
    framework?: LocalizedText;
    reflection?: LocalizedText;
  };
  nextAction?: { href: string; label: LocalizedText };
  glossaryIds: string[];
  sourceIds: string[];
  knowledgeCheckIds?: string[];
  resolvedGlossary?: GlossaryDefinition[];
  resolvedSources?: Array<{
    id: string;
    title: string;
    publisher: string;
    url: string;
  }>;
  resolvedReviewCards?: ReviewCardDefinition[];
};

export type AcademyPathDetail = LearningPathSummary & {
  prerequisitePathIds: string[];
  completionCriteria: Record<string, number> | null;
  finalAssessmentId: string | null;
  modules: AcademyModule[];
  lessons: DemoLesson[];
};

export type AcademyQuizQuestion = {
  id: string;
  lessonId: string;
  type:
    | "single_choice"
    | "multiple_choice"
    | "numerical"
    | "formula_calculation"
    | "ordering"
    | "matching"
    | "chart_based"
    | "scenario_decision"
    | "short_reflection";
  prompt: LocalizedText;
  options?: Array<{ id: string; text: LocalizedText }>;
  items?: Array<{ id: string; text: LocalizedText }>;
  leftItems?: Array<{ id: string; text: LocalizedText }>;
  rightItems?: Array<{ id: string; text: LocalizedText }>;
  chartExerciseId?: string;
  scenarioId?: string;
  reviewRecommended?: boolean;
};

export type AcademyQuiz = {
  id: string;
  lessonId: string;
  questions: AcademyQuizQuestion[];
};

export type QuizQuestion = {
  id: string;
  prompt: LocalizedText;
  options: Array<{ id: string; label: LocalizedText }>;
  correctOptionId: string;
  explanation: LocalizedText;
  alternatives: LocalizedText;
};

export type ReviewCardDefinition = {
  id: string;
  front: LocalizedText;
  back: LocalizedText;
};

export type GlossaryDefinition = {
  id: string;
  term: LocalizedText;
  definition: LocalizedText;
};

export type DemoCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DemoScenario = {
  id: string;
  title: LocalizedText;
  context: LocalizedText;
  goal: LocalizedText;
  candles: DemoCandle[];
  initialVisibleCandles: number;
};

export type JournalEntry = {
  id: string;
  createdAt: string;
  setup: string;
  thesis: string;
  context: string;
  entry: number;
  stop: number;
  target: number;
  plannedRisk: number;
  actualRisk?: number;
  resultAmount?: number;
  resultR: number;
  emotionBefore: string;
  emotionDuring?: string;
  emotionAfter: string;
  followedRules: boolean;
  lesson: string;
  tags: string[];
  chartSnapshotUrl?: string;
};

export type SimulatorSummary = {
  completedAt: string;
  netPnl: number;
  trades: number;
  ruleViolations: number;
  processScore: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdown: number;
  remoteSessionId?: string;
  followedRules?: string[];
  violatedRules?: string[];
  unevaluatedRules?: string[];
  debrief?: Record<string, unknown>;
  relatedLessons?: string[];
  recommendedReviewCards?: string[];
};

export type OnboardingAnswers = {
  goal: string;
  level: string;
  interest: string;
  weekly: string;
  experience: string;
  risk: string;
  style: string;
  placement: string;
  recommendation: string;
};

export type SerializedReviewCard = {
  cardId: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview?: string;
  history: Array<{ rating: number; reviewedAt: string; due: string }>;
};

export type DemoWorkspaceState = {
  version: 1;
  onboarding: OnboardingAnswers | null;
  completedLessons: string[];
  bookmarks: string[];
  lessonNotes: Record<string, string>;
  quizScores: Record<string, number>;
  reviewCards: Record<string, SerializedReviewCard>;
  journalEntries: JournalEntry[];
  simulatorSummary: SimulatorSummary | null;
};
