import type { Metadata } from "next";
import {
  BookMarked,
  Clock3,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { WorkspacePreview } from "@/features/previews/workspace-preview";

export const metadata: Metadata = {
  title: "Paper Trading Preview | Borza",
  description:
    "An honest preview of a future deterministic paper-trading workspace.",
};

const principles = [
  {
    title: "Deterministic simulation",
    description:
      "Orders will follow explicit simulated execution rules rather than opaque or fabricated outcomes.",
    icon: SlidersHorizontal,
  },
  {
    title: "Risk controls",
    description:
      "Position and loss guardrails will be visible before a simulated order is accepted.",
    icon: ShieldCheck,
  },
  {
    title: "Decision journal",
    description:
      "The workspace will connect each simulated decision to a written rationale and later review.",
    icon: BookMarked,
  },
  {
    title: "Labeled delayed data",
    description:
      "Market inputs will retain their source and delay so the simulation never implies live execution.",
    icon: Clock3,
  },
] as const;

export default function PaperPreviewPage() {
  return (
    <WorkspacePreview
      eyebrow="Future simulation experience"
      title="Practice decisions without pretending to trade"
      description="The planned Paper Trading workspace will support transparent simulated orders, risk controls, and disciplined review while remaining separate from live brokerage execution."
      principles={principles}
      disclosure="There are no balances, positions, orders, returns, charts, or brokerage connections in this release. The first implementation will not execute live trades."
    />
  );
}
