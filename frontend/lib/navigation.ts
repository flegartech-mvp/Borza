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
    label: "Märkte",
    shortLabel: "Märkte",
    description: "Deutsche und europäische Marktlage",
    icon: "overview",
    availability: "current",
  },
  {
    href: "/news",
    label: "Katalysatoren",
    shortLabel: "Signale",
    description: "Ereignisse, Quellen und Relevanz",
    icon: "news",
    availability: "current",
  },
  {
    href: "/learn",
    label: "Lernen",
    shortLabel: "Lernen",
    description: "Finanzwissen zu realen Marktbewegungen",
    icon: "learn",
    availability: "current",
  },
] as const;

export const FUTURE_NAVIGATION: readonly WorkspaceNavigationItem[] = [];

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
    title: item?.label ?? "Arbeitsbereich",
    context: item?.description ?? "Finanznachrichten und Marktinformationen",
  };
}
