import { describe, expect, it, vi } from "vitest";
import type { JournalEntry, OnboardingAnswers } from "@/lib/academy-types";
import { hydrateWorkspace, onboardingRequest, workspaceRequests, type DashboardRead } from "./demo-workspace-provider";

const onboarding: OnboardingAnswers = {
  goal: "Understand finance from zero",
  level: "Beginner",
  interest: "Mostly finance",
  weekly: "3–4 hours",
  experience: "None",
  risk: "New to me",
  style: "Interactive exercises",
  placement: "Position size limits the loss",
  recommendation: "path-finance-foundations",
};

const journal: JournalEntry = {
  id: "journal-1",
  createdAt: "2026-08-01T08:00:00Z",
  setup: "Pullback",
  thesis: "Structure remains intact",
  context: "Simulated uptrend",
  entry: 101,
  stop: 99,
  target: 105,
  plannedRisk: 50,
  resultR: 1.5,
  emotionBefore: "calm",
  emotionAfter: "focused",
  followedRules: true,
  lesson: "Wait for invalidation",
  tags: ["discipline"],
};

describe("authenticated workspace contracts", () => {
  it("maps onboarding and sends the documented POST shape", async () => {
    const request = vi.fn(async () => undefined);
    await workspaceRequests.saveOnboarding(request, onboarding);
    expect(onboardingRequest(onboarding)).toMatchObject({ weekly_study_minutes: 210, placement_score: 100 });
    expect(request).toHaveBeenCalledWith("/onboarding", { method: "POST", body: expect.objectContaining({ learning_goal: onboarding.goal, answers: onboarding }) });
  });

  it("uses PUT and DELETE contracts for progress, notes, and bookmarks", async () => {
    const request = vi.fn(async () => undefined);
    await workspaceRequests.completeLesson(request, "lesson-a");
    await workspaceRequests.saveNote(request, "lesson-a", "My note");
    await workspaceRequests.setBookmark(request, "lesson-a", true);
    await workspaceRequests.setBookmark(request, "lesson-a", false);
    expect(request).toHaveBeenNthCalledWith(1, "/lessons/lesson-a/progress", { method: "PUT", body: { status: "completed", progress_percent: 100, content_version: "1" } });
    expect(request).toHaveBeenNthCalledWith(2, "/lessons/lesson-a/notes", { method: "PUT", body: { body: "My note" } });
    expect(request).toHaveBeenNthCalledWith(3, "/lessons/lesson-a/bookmark", { method: "PUT" });
    expect(request).toHaveBeenNthCalledWith(4, "/lessons/lesson-a/bookmark", { method: "DELETE" });
  });

  it("maps the journal schema and hydrates remote state without local demo data", async () => {
    const request = vi.fn(async () => undefined);
    await workspaceRequests.addJournal(request, journal);
    expect(request).toHaveBeenCalledWith("/journal", { method: "POST", body: expect.objectContaining({ market_context: journal.context, entry_price: 101, actual_risk: 50, rule_adherence: 100, lesson_learned: journal.lesson }) });

    const dashboard: DashboardRead = {
      profile: { display_name: "Ada", locale: "en", timezone: "Europe/Ljubljana" },
      onboarding: { completed: true, recommended_path_id: "path-risk-management" },
      progress: [],
      completed_lesson_count: 1,
      bookmarks: ["lesson-a"],
      note_count: 1,
      due_review_count: 2,
      recent_journal: [],
      simulator: null,
      mastery: [],
      streak: { current_days: 3, longest_days: 5, last_activity_date: "2026-08-01" },
    };
    const hydrated = hydrateWorkspace(
      dashboard,
      [{ lesson_id: "lesson-a", status: "completed", progress_percent: 100, best_score: "85" }],
      [{ lesson_id: "lesson-a" }],
      [{ id: "remote-journal", created_at: "2026-08-01T08:00:00Z", setup: "Remote", thesis: "Remote thesis", market_context: "Remote context", entry_price: "100", stop_price: "99", target_price: "103", planned_risk: "25", r_multiple: "2", emotions_before: null, emotions_after: null, rule_adherence: 90, lesson_learned: "Remote lesson", tags: [] }],
    );
    expect(hydrated.state.completedLessons).toEqual(["lesson-a"]);
    expect(hydrated.state.bookmarks).toEqual(["lesson-a"]);
    expect(hydrated.state.quizScores["lesson-a"]).toBe(85);
    expect(hydrated.state.journalEntries[0].id).toBe("remote-journal");
    expect(hydrated.state.onboarding?.recommendation).toBe("path-risk-management");
  });
});
