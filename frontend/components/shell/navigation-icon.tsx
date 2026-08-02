import {
  Award,
  BookOpenText,
  BookText,
  Calculator,
  ChartCandlestick,
  ChartNoAxesCombined,
  CircleUserRound,
  ClipboardCheck,
  Gauge,
  House,
  LibraryBig,
  NotebookPen,
  Settings,
} from "lucide-react";
import type { NavigationIconName } from "@/lib/navigation";

const icons = {
  home: House,
  learn: BookOpenText,
  practice: ChartCandlestick,
  simulator: ChartNoAxesCombined,
  tools: Calculator,
  review: ClipboardCheck,
  journal: NotebookPen,
  profile: CircleUserRound,
  glossary: LibraryBig,
  progress: Gauge,
  achievements: Award,
  settings: Settings,
} satisfies Record<NavigationIconName, typeof BookText>;

export function NavigationIcon({
  name,
  size = 18,
  className,
}: {
  name: NavigationIconName;
  size?: number;
  className?: string;
}) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" size={size} className={className} />;
}
