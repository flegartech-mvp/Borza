import type { Metadata } from "next";
import { NewsWorkspace } from "@/features/workspace/data-workspaces";
import { parseFilterSearchParams } from "@/lib/filters";

export const metadata: Metadata = {
  title: "Katalysatoren | Borza",
  description:
    "Deutsche und europäische Finanznachrichten nach Quelle, Relevanz, Markt und Ticker filtern.",
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
