import type { Metadata } from "next";
import { SchoolsPage } from "@/features/marketing/schools-page";

export const metadata: Metadata = {
  title: "Programme for Slovenian schools",
  description:
    "A proposed 35-hour practical financial-literacy programme for Slovenian secondary schools.",
};

export default function Page() {
  return <SchoolsPage />;
}
