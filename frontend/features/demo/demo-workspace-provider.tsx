"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { academyApi } from "@/lib/api-client";
import type { DemoWorkspaceState, JournalEntry, OnboardingAnswers, SerializedReviewCard, SimulatorSummary } from "@/lib/academy-types";

const STORAGE_KEY = "borza-academy-demo-v1";
const CHANGE_EVENT = "borza:academy-demo-change";
const REMOTE_QUERY_KEY = ["academy", "authenticated-workspace"] as const;

export const EMPTY_DEMO_STATE: DemoWorkspaceState = { version: 1, onboarding: null, completedLessons: [], bookmarks: [], lessonNotes: {}, quizScores: {}, reviewCards: {}, journalEntries: [], simulatorSummary: null };

let cachedRaw: string | null | undefined;
let cachedState = EMPTY_DEMO_STATE;

function parseState(raw: string | null): DemoWorkspaceState {
  if (!raw) return EMPTY_DEMO_STATE;
  try {
    const value = JSON.parse(raw) as Partial<DemoWorkspaceState>;
    if (value.version !== 1) return EMPTY_DEMO_STATE;
    return { ...EMPTY_DEMO_STATE, ...value, completedLessons: Array.isArray(value.completedLessons) ? value.completedLessons : [], bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : [], lessonNotes: value.lessonNotes ?? {}, quizScores: value.quizScores ?? {}, reviewCards: value.reviewCards ?? {}, journalEntries: Array.isArray(value.journalEntries) ? value.journalEntries : [] };
  } catch { return EMPTY_DEMO_STATE; }
}

function readSnapshot(): DemoWorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) { cachedRaw = raw; cachedState = parseState(raw); }
    return cachedState;
  } catch { return EMPTY_DEMO_STATE; }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(CHANGE_EVENT, onChange); };
}

function writeState(next: DemoWorkspaceState): void {
  cachedState = next;
  cachedRaw = JSON.stringify(next);
  try { window.localStorage.setItem(STORAGE_KEY, cachedRaw); } catch { /* In-memory demo still works. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export type QuizSubmissionResult = {
  correct_count: number;
  question_count: number;
  score_percent: number | string;
  feedback: Array<{ question_id: string; correct: boolean; explanation: unknown; correct_answer: unknown; review_recommended: boolean }>;
};

export type DashboardRead = {
  profile: { display_name: string | null; locale: string; timezone: string } | null;
  onboarding: { completed: boolean; recommended_path_id: string | null };
  progress: Array<{ lesson_id: string; status: string; progress_percent: number; best_score: number | string | null; updated_at: string }>;
  completed_lesson_count: number;
  bookmarks: string[];
  note_count: number;
  due_review_count: number;
  recent_journal: Array<{ id: string; setup: string; result_amount: number | string | null; r_multiple: number | string | null; created_at: string }>;
  simulator: { session_id: string; scenario_id: string; status: string; equity: number | string; realized_pnl: number | string } | null;
  mastery: Array<{ skill_id: string; state: string; score: number; evidence_count: number }>;
  streak: { current_days: number; longest_days: number; last_activity_date: string | null };
};

type ProgressRead = { lesson_id: string; status: string; progress_percent: number; best_score: number | string | null };
type BookmarkRead = { lesson_id: string };
type JournalRead = { id: string; created_at: string; setup: string; thesis: string; market_context: string; entry_price: number | string | null; stop_price: number | string | null; target_price: number | string | null; planned_risk: number | string | null; actual_risk?: number | string | null; result_amount?: number | string | null; r_multiple: number | string | null; emotions_before: string | null; emotions_during?: string | null; emotions_after: string | null; rule_adherence: number | null; lesson_learned: string; chart_snapshot_url?: string | null; tags: string[] };
type RemoteBundle = { state: DemoWorkspaceState; dashboard: DashboardRead };

const number = (value: number | string | null | undefined) => Number(value ?? 0);

function weeklyMinutes(value: string): number {
  if (/5\s*\+/.test(value)) return 300;
  if (/3\s*[–-]\s*4/.test(value)) return 210;
  return 90;
}

export function onboardingRequest(answers: OnboardingAnswers) {
  const skipped = /skip|überspringen|presko/i.test(answers.placement);
  const correct = /position|positionsgröße|velikost pozicije/i.test(answers.placement);
  return {
    learning_goal: answers.goal,
    experience_level: answers.level,
    primary_interest: answers.interest,
    weekly_study_minutes: weeklyMinutes(answers.weekly),
    prior_market_experience: answers.experience,
    risk_knowledge: answers.risk,
    learning_style: answers.style,
    placement_score: skipped ? null : correct ? 100 : 0,
    answers: { ...answers },
  };
}

export function journalRequest(entry: JournalEntry) {
  return {
    setup: entry.setup,
    thesis: entry.thesis,
    market_context: entry.context,
    entry_price: entry.entry,
    stop_price: entry.stop,
    target_price: entry.target,
    planned_risk: entry.plannedRisk,
    actual_risk: entry.actualRisk ?? entry.plannedRisk,
    result_amount: entry.resultAmount ?? null,
    r_multiple: entry.resultR,
    emotions_before: entry.emotionBefore || null,
    emotions_during: entry.emotionDuring || null,
    emotions_after: entry.emotionAfter || null,
    rule_adherence: entry.followedRules ? 100 : 0,
    lesson_learned: entry.lesson,
    chart_snapshot_url: entry.chartSnapshotUrl || null,
    tags: entry.tags,
  };
}

type Requester = (path: string, options?: { method?: string; body?: unknown }) => Promise<unknown>;

export const workspaceRequests = {
  saveOnboarding: (request: Requester, answers: OnboardingAnswers) => request("/onboarding", { method: "POST", body: onboardingRequest(answers) }),
  completeLesson: (request: Requester, lessonId: string) => request(`/lessons/${lessonId}/progress`, { method: "PUT", body: { status: "completed", progress_percent: 100, content_version: "1" } }),
  setBookmark: (request: Requester, lessonId: string, bookmarked: boolean) => request(`/lessons/${lessonId}/bookmark`, { method: bookmarked ? "PUT" : "DELETE" }),
  saveNote: (request: Requester, lessonId: string, note: string) => request(`/lessons/${lessonId}/notes`, { method: "PUT", body: { body: note } }),
  addJournal: (request: Requester, entry: JournalEntry) => request("/journal", { method: "POST", body: journalRequest(entry) }),
};

export function hydrateWorkspace(dashboard: DashboardRead, progress: ProgressRead[], bookmarks: BookmarkRead[], journal: JournalRead[]): RemoteBundle {
  const onboarding: OnboardingAnswers | null = dashboard.onboarding.completed ? { goal: "", level: "", interest: "", weekly: "", experience: "", risk: "", style: "", placement: "", recommendation: dashboard.onboarding.recommended_path_id ?? "path-finance-foundations" } : null;
  return {
    dashboard,
    state: {
      ...EMPTY_DEMO_STATE,
      onboarding,
      completedLessons: progress.filter((item) => item.status === "completed").map((item) => item.lesson_id),
      bookmarks: bookmarks.map((item) => item.lesson_id),
      quizScores: Object.fromEntries(progress.filter((item) => item.best_score !== null).map((item) => [item.lesson_id, number(item.best_score)])),
      journalEntries: journal.map((item) => ({ id: item.id, createdAt: item.created_at, setup: item.setup, thesis: item.thesis, context: item.market_context, entry: number(item.entry_price), stop: number(item.stop_price), target: number(item.target_price), plannedRisk: number(item.planned_risk), actualRisk: number(item.actual_risk), resultAmount: number(item.result_amount), resultR: number(item.r_multiple), emotionBefore: item.emotions_before ?? "", emotionDuring: item.emotions_during ?? "", emotionAfter: item.emotions_after ?? "", followedRules: (item.rule_adherence ?? 0) >= 80, lesson: item.lesson_learned, chartSnapshotUrl: item.chart_snapshot_url ?? "", tags: item.tags })),
      simulatorSummary: dashboard.simulator ? { completedAt: new Date().toISOString(), remoteSessionId: dashboard.simulator.session_id, netPnl: number(dashboard.simulator.realized_pnl), trades: 0, ruleViolations: 0, processScore: 0, winRate: 0, expectancy: 0, profitFactor: 0, maxDrawdown: 0 } : null,
    },
  };
}

async function fetchRemoteWorkspace(): Promise<RemoteBundle> {
  const [dashboard, progress, bookmarks, journal] = await Promise.all([
    academyApi<DashboardRead>("/dashboard"),
    academyApi<ProgressRead[]>("/progress"),
    academyApi<BookmarkRead[]>("/bookmarks"),
    academyApi<{ items: JournalRead[] }>("/journal?limit=100&offset=0"),
  ]);
  return hydrateWorkspace(dashboard, progress, bookmarks, journal.items);
}

type WorkspaceContextValue = {
  state: DemoWorkspaceState;
  dashboard: DashboardRead | null;
  mode: "demo" | "authenticated";
  hydrating: boolean;
  hydrationError: boolean;
  refresh: () => Promise<void>;
  loadLessonNote: (lessonId: string) => Promise<string>;
  saveOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  completeLesson: (lessonId: string) => Promise<void>;
  toggleBookmark: (lessonId: string) => Promise<void>;
  saveLessonNote: (lessonId: string, note: string) => Promise<void>;
  recordQuizScore: (quizId: string, score: number, answers: Array<{ question_id: string; answer: unknown }>) => Promise<QuizSubmissionResult | null>;
  saveReviewCard: (card: SerializedReviewCard, rating: "again" | "hard" | "good" | "easy") => Promise<void>;
  addJournalEntry: (entry: JournalEntry) => Promise<void>;
  saveSimulatorSummary: (summary: SimulatorSummary) => Promise<void>;
  resetDemo: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const localState = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_DEMO_STATE);
  const remote = useQuery({ queryKey: REMOTE_QUERY_KEY, queryFn: fetchRemoteWorkspace, enabled: Boolean(user), retry: 1 });
  const state = user ? remote.data?.state ?? EMPTY_DEMO_STATE : localState;
  const request: Requester = useCallback((path, options) => academyApi(path, options), []);
  const invalidate = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: REMOTE_QUERY_KEY }); }, [queryClient]);
  const refresh = useCallback(async () => { if (user) await remote.refetch(); }, [remote, user]);

  const saveOnboarding = useCallback(async (answers: OnboardingAnswers) => {
    if (user) { await workspaceRequests.saveOnboarding(request, answers); await invalidate(); }
    else writeState({ ...state, onboarding: answers });
  }, [invalidate, request, state, user]);
  const completeLesson = useCallback(async (lessonId: string) => {
    if (user) { await workspaceRequests.completeLesson(request, lessonId); await invalidate(); return; }
    const completedLessons = state.completedLessons.includes(lessonId) ? state.completedLessons : [...state.completedLessons, lessonId];
    writeState({ ...state, completedLessons });
  }, [invalidate, request, state, user]);
  const toggleBookmark = useCallback(async (lessonId: string) => {
    const currentlyBookmarked = state.bookmarks.includes(lessonId);
    if (user) { await workspaceRequests.setBookmark(request, lessonId, !currentlyBookmarked); await invalidate(); return; }
    writeState({ ...state, bookmarks: currentlyBookmarked ? state.bookmarks.filter((id) => id !== lessonId) : [...state.bookmarks, lessonId] });
  }, [invalidate, request, state, user]);
  const loadLessonNote = useCallback(async (lessonId: string) => {
    if (!user) return localState.lessonNotes[lessonId] ?? "";
    try {
      const note = await academyApi<{ body: string }>(`/lessons/${lessonId}/notes`);
      queryClient.setQueryData<RemoteBundle>(REMOTE_QUERY_KEY, (current) => current ? { ...current, state: { ...current.state, lessonNotes: { ...current.state.lessonNotes, [lessonId]: note.body } } } : current);
      return note.body;
    } catch (reason) {
      if (reason && typeof reason === "object" && "status" in reason && reason.status === 404) return "";
      throw reason;
    }
  }, [localState.lessonNotes, queryClient, user]);
  const saveLessonNote = useCallback(async (lessonId: string, note: string) => {
    const normalized = note.trim();
    if (!normalized) throw new Error("A lesson note cannot be empty.");
    if (user) {
      await workspaceRequests.saveNote(request, lessonId, normalized);
      queryClient.setQueryData<RemoteBundle>(REMOTE_QUERY_KEY, (current) => current ? { ...current, state: { ...current.state, lessonNotes: { ...current.state.lessonNotes, [lessonId]: normalized } } } : current);
      return;
    }
    writeState({ ...state, lessonNotes: { ...state.lessonNotes, [lessonId]: normalized } });
  }, [queryClient, request, state, user]);
  const recordQuizScore = useCallback(async (quizId: string, score: number, answers: Array<{ question_id: string; answer: unknown }>) => {
    if (user) {
      const result = await academyApi<QuizSubmissionResult>(`/quizzes/${quizId}/attempts`, { method: "POST", body: { answers } });
      await invalidate();
      return result;
    }
    writeState({ ...state, quizScores: { ...state.quizScores, [quizId]: score } });
    return null;
  }, [invalidate, state, user]);
  const saveReviewCard = useCallback(async (card: SerializedReviewCard, rating: "again" | "hard" | "good" | "easy") => {
    if (user) {
      await academyApi(`/review/cards/${card.cardId}`, { method: "POST", body: { rating, due_at: card.due, stability: card.stability, difficulty: card.difficulty, state: ["new", "learning", "review", "relearning"][card.state] ?? "new", reps: card.reps, lapses: card.lapses, last_review: card.lastReview } });
      await queryClient.invalidateQueries({ queryKey: ["academy", "review-queue"] });
      return;
    }
    writeState({ ...state, reviewCards: { ...state.reviewCards, [card.cardId]: card } });
  }, [queryClient, state, user]);
  const addJournalEntry = useCallback(async (entry: JournalEntry) => {
    if (user) { await workspaceRequests.addJournal(request, entry); await invalidate(); return; }
    writeState({ ...state, journalEntries: [entry, ...state.journalEntries] });
  }, [invalidate, request, state, user]);
  const saveSimulatorSummary = useCallback(async (summary: SimulatorSummary) => {
    if (user) { await invalidate(); return; }
    writeState({ ...state, simulatorSummary: summary });
  }, [invalidate, state, user]);
  const resetDemo = useCallback(() => { if (!user) writeState(EMPTY_DEMO_STATE); }, [user]);

  const value = useMemo<WorkspaceContextValue>(() => ({ state, dashboard: user ? remote.data?.dashboard ?? null : null, mode: user ? "authenticated" : "demo", hydrating: Boolean(user && remote.isLoading), hydrationError: Boolean(user && remote.isError), refresh, loadLessonNote, saveOnboarding, completeLesson, toggleBookmark, saveLessonNote, recordQuizScore, saveReviewCard, addJournalEntry, saveSimulatorSummary, resetDemo }), [addJournalEntry, completeLesson, loadLessonNote, recordQuizScore, refresh, remote.data?.dashboard, remote.isError, remote.isLoading, resetDemo, saveLessonNote, saveOnboarding, saveReviewCard, saveSimulatorSummary, state, toggleBookmark, user]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useDemoWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useDemoWorkspace must be used inside DemoWorkspaceProvider");
  return context;
}
