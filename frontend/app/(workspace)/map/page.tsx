import type { Metadata } from "next";
import { MapWorkspace } from "@/features/workspace/data-workspaces";

export const metadata: Metadata = {
  title: "World Map | Borza",
  description:
    "Explore source-story geographic coverage without treating news concentration as market performance.",
};

export default function MapPage() {
  return <MapWorkspace />;
}
