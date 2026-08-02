import type { Metadata } from "next";
import { ImpactPage } from "@/features/marketing/impact-page";

export const metadata: Metadata = {
  title: "Impact and support",
  description:
    "How Borza Academy can support practical financial literacy through transparent school pilots and responsible funding.",
};

export default function Page() {
  return <ImpactPage />;
}
