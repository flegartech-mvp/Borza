import {
  BookOpenText,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutDashboard,
  Map,
  Newspaper,
} from "lucide-react";
import type { NavigationIcon as NavigationIconName } from "@/lib/navigation";

const icons = {
  overview: LayoutDashboard,
  news: Newspaper,
  map: Map,
  learn: BookOpenText,
  study: GraduationCap,
  paper: ChartNoAxesCombined,
} as const;

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
