import type { Metadata } from "next";
import { OverviewWorkspace } from "@/features/workspace/data-workspaces";

export const metadata: Metadata = {
  title: "Overview | Borza",
  description:
    "A source-labeled overview of current financial news, tone, attention, and market context.",
};

export default function OverviewPage() {
  return <OverviewWorkspace />;
}
