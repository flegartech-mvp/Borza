import type { AcademyDictionary } from "@/i18n/dictionaries";

export type NavigationIconName =
  | "home"
  | "learn"
  | "practice"
  | "simulator"
  | "tools"
  | "review"
  | "journal"
  | "profile"
  | "glossary"
  | "progress"
  | "achievements"
  | "settings";

export type NavigationItem = {
  id: NavigationIconName;
  href: string;
  label: string;
  icon: NavigationIconName;
};

const primaryDefinitions = [
  ["home", "/home"],
  ["learn", "/learn"],
  ["practice", "/practice"],
  ["simulator", "/simulator"],
  ["tools", "/tools"],
  ["review", "/review"],
  ["journal", "/journal"],
  ["profile", "/profile"],
] as const;

const secondaryDefinitions = [
  ["glossary", "/glossary"],
  ["progress", "/progress"],
  ["achievements", "/achievements"],
  ["settings", "/settings"],
] as const;

function items(
  definitions: ReadonlyArray<readonly [NavigationIconName, string]>,
  dictionary: AcademyDictionary,
): NavigationItem[] {
  return definitions.map(([id, href]) => ({
    id,
    href,
    icon: id,
    label: dictionary.nav[id],
  }));
}

export function primaryNavigation(
  dictionary: AcademyDictionary,
): NavigationItem[] {
  return items(primaryDefinitions, dictionary);
}

export function secondaryNavigation(
  dictionary: AcademyDictionary,
): NavigationItem[] {
  return items(secondaryDefinitions, dictionary);
}

export function mobileNavigation(
  dictionary: AcademyDictionary,
): NavigationItem[] {
  return primaryNavigation(dictionary).slice(0, 4);
}

export function isNavigationItemActive(
  pathname: string,
  href: string,
): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitle(
  pathname: string,
  dictionary: AcademyDictionary,
): string {
  const item = [
    ...primaryNavigation(dictionary),
    ...secondaryNavigation(dictionary),
  ].find((entry) => isNavigationItemActive(pathname, entry.href));
  if (pathname.startsWith("/lesson/")) return dictionary.lesson.core;
  if (pathname.startsWith("/quiz/")) return dictionary.quiz.title;
  if (pathname.startsWith("/onboarding")) return dictionary.onboarding.title;
  return item?.label ?? dictionary.brand.name;
}
