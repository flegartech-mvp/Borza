import { NewsWorkspace } from "@/features/workspace/data-workspaces";
import { DEFAULT_FILTERS, type FilterIssue, type Filters } from "@/lib/filters";

/**
 * Compatibility export for the Phase 0 filter tests. Runtime pages now mount
 * focused route workspaces instead of the former one-page dashboard.
 */
export function Dashboard({
  initialFilters = DEFAULT_FILTERS,
  initialFilterIssues = [],
}: {
  initialFilters?: Filters;
  initialFilterIssues?: FilterIssue[];
}) {
  return (
    <NewsWorkspace
      initialFilters={initialFilters}
      initialFilterIssues={initialFilterIssues}
    />
  );
}
