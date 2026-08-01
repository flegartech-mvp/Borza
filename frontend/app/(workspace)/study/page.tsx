import type { Metadata } from "next";
import { BookOpenCheck, FileSearch, Library, ListChecks } from "lucide-react";
import { WorkspacePreview } from "@/features/previews/workspace-preview";

export const metadata: Metadata = {
  title: "Student Workspace Preview | Borza",
  description: "An honest preview of Borza's future private study workspace.",
};

const principles = [
  {
    title: "Private, lawful materials",
    description:
      "Students will be able to organize material they are permitted to use without Borza scraping restricted university content.",
    icon: Library,
  },
  {
    title: "Cited document questions",
    description:
      "Answers will point back to uploaded source passages instead of presenting unsupported generated claims.",
    icon: FileSearch,
  },
  {
    title: "Study practice",
    description:
      "Flashcards and quizzes will be grounded in the student's own organized course material.",
    icon: ListChecks,
  },
  {
    title: "Exam planning",
    description:
      "Planning tools will help structure revision without inventing course progress or completion scores.",
    icon: BookOpenCheck,
  },
] as const;

export default function StudyPreviewPage() {
  return (
    <WorkspacePreview
      eyebrow="Future student experience"
      title="A private workspace for serious study"
      description="The planned Student Workspace will initially focus on economics students in Ljubljana and Maribor, combining lawful course organization with cited learning tools."
      principles={principles}
      disclosure="No uploads, courses, document Q&A, flashcards, quizzes, progress tracking, or exam plans are active yet. Borza is independent and is not affiliated with the University of Ljubljana or the University of Maribor."
    />
  );
}
