import type { Metadata } from "next";
import { NewsWorkspace } from "@/features/workspace/data-workspaces";
import { parseFilterSearchParams } from "@/lib/filters";

export const metadata: Metadata = {
  title: "News Explorer | Borza",
  description:
    "Search and filter source-backed financial news with transparent contextual metadata.",
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { filters, issues } = parseFilterSearchParams(query);
  return (
    <NewsWorkspace initialFilters={filters} initialFilterIssues={issues} />
  );
}
