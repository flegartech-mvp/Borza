export type NavigationIcon =
  "overview" | "news" | "map" | "learn" | "study" | "paper";

export type WorkspaceNavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: NavigationIcon;
  availability: "current" | "preview";
};

export const PRIMARY_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  {
    href: "/",
    label: "Overview",
    shortLabel: "Overview",
    description: "Current market-news context",
    icon: "overview",
    availability: "current",
  },
  {
    href: "/news",
    label: "News Explorer",
    shortLabel: "News",
    description: "Search and filter source stories",
    icon: "news",
    availability: "current",
  },
  {
    href: "/map",
    label: "World Map",
    shortLabel: "Map",
    description: "Explore geographic coverage",
    icon: "map",
    availability: "current",
  },
  {
    href: "/learn",
    label: "Learn",
    shortLabel: "Learn",
    description: "Understand Borza methods",
    icon: "learn",
    availability: "current",
  },
] as const;

export const FUTURE_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  {
    href: "/study",
    label: "Student Workspace",
    shortLabel: "Study",
    description: "Private study tools preview",
    icon: "study",
    availability: "preview",
  },
  {
    href: "/paper",
    label: "Paper Trading",
    shortLabel: "Paper",
    description: "Simulation workspace preview",
    icon: "paper",
    availability: "preview",
  },
] as const;

export function isNavigationItemActive(
  pathname: string,
  href: string,
): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function pageMetadata(pathname: string): {
  title: string;
  context: string;
} {
  const item = [...PRIMARY_NAVIGATION, ...FUTURE_NAVIGATION].find((entry) =>
    isNavigationItemActive(pathname, entry.href),
  );
  return {
    title: item?.label ?? "Workspace",
    context: item?.description ?? "Financial news and market intelligence",
  };
}
