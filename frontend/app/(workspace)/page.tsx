import type { Metadata } from "next";
import { OverviewWorkspace } from "@/features/workspace/data-workspaces";

export const metadata: Metadata = {
  title: "Märkte | Borza",
  description:
    "Quellenbasierter Überblick über deutsche und europäische Marktnachrichten, Relevanz und Kontext.",
};

export default function OverviewPage() {
  return <OverviewWorkspace />;
}
