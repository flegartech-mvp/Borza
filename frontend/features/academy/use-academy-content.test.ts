import { describe, expect, it } from "vitest";
import { lessonFromBackend, quizFromBackend } from "./use-academy-content";

const text = (value: string) => ({ de: value, sl: value, en: value });

describe("Academy content adapters", () => {
  it("adapts structured lesson blocks and string source titles", () => {
    const lesson = lessonFromBackend({
      id: "lesson-a",
      path_id: "path-a",
      module_id: "module-a",
      duration_minutes: 12,
      title: text("Lesson"),
      summary: text("Summary"),
      objectives: { de: ["One"], sl: ["One"], en: ["One"] },
      content: {
        core: text("Core"),
        visual: { caption: text("Caption") },
        interactive: { prompt: text("Prompt") },
        worked_example: text("Worked"),
        common_mistake: text("Mistake"),
        takeaway: text("Takeaway"),
      },
      sources: ["source-a"],
      resolved_sources: [
        {
          id: "source-a",
          publisher: "Investor.gov",
          title: "Introduction to Investing",
          url: "https://www.investor.gov/introduction-investing",
        },
      ],
    });
    expect(lesson.sections.visual.en).toBe("Caption");
    expect(lesson.sections.exercise.de).toBe("Prompt");
    expect(lesson.resolvedSources?.[0]).toEqual({
      id: "source-a",
      publisher: "Investor.gov",
      title: "Introduction to Investing",
      url: "https://www.investor.gov/introduction-investing",
    });
  });

  it("keeps separate left and right matching items", () => {
    const quiz = quizFromBackend({
      id: "lesson-a",
      lesson_id: "lesson-a",
      questions: [
        {
          id: "q-match",
          lesson_id: "lesson-a",
          type: "matching",
          prompt: text("Match"),
          left_items: [{ id: "left-risk", text: text("Risk") }],
          right_items: [{ id: "right-risk", text: text("Uncertainty") }],
        },
      ],
    });
    expect(quiz.questions[0].leftItems?.[0].id).toBe("left-risk");
    expect(quiz.questions[0].rightItems?.[0].id).toBe("right-risk");
  });
});
