import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import classroomPayload from "../../../../../content/academy/classroom_activities.json";
import { MarketingPage } from "@/features/marketing/marketing-shell";

const activities = classroomPayload.activities;

export function generateStaticParams() {
  return activities.map((activity) => ({ activityId: activity.id }));
}

export default async function TeacherMaterialPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) notFound();
  const materialPath = path.join(
    process.cwd(),
    "..",
    "content",
    "academy",
    activity.material,
  );
  const markdown = await readFile(materialPath, "utf8");
  return (
    <MarketingPage>
      <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">
          Borza Academy · Teacher material · v{activity.version}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-.04em]">
          {activity.title.en}
        </h1>
        <p className="mt-4 leading-7 text-[var(--text-secondary)]">
          {activity.summary.en}
        </p>
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-8">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[var(--text-secondary)]">
            {markdown}
          </pre>
        </div>
      </article>
    </MarketingPage>
  );
}
