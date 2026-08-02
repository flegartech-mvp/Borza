import {
  Award,
  BadgeCheck,
  BrainCircuit,
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
  Presentation,
  Scale,
  Settings,
  ShieldAlert,
  WalletCards,
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
  lifeSimulator: WalletCards,
  scamDetector: ShieldAlert,
  decisionLab: Scale,
  passport: BadgeCheck,
  mentor: BrainCircuit,
  teacher: Presentation,
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
