"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LanguageSwitcher, ThemeSwitcher, usePreferences } from "@/features/preferences";
import { isNavigationItemActive, primaryNavigation, secondaryNavigation } from "@/lib/navigation";
import { BrandMark } from "./brand-mark";
import { NavigationIcon } from "./navigation-icon";
import { shellCopy } from "./shell-copy";

const STORAGE_KEY = "borza-academy-sidebar-collapsed";
const EVENT = "borza:academy-sidebar";
const subscribe = (listener: () => void) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
const snapshot = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
};

export function SidebarNav() {
  const pathname = usePathname();
  const { dictionary, language } = usePreferences();
  const copy = shellCopy[language];
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  const setCollapsed = (next: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* optional */ }
    window.dispatchEvent(new Event(EVENT));
  };
  const renderItems = (items: ReturnType<typeof primaryNavigation>) =>
    items.map((item) => {
      const active = isNavigationItemActive(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          className={`flex min-h-10 items-center rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition-colors ${collapsed ? "justify-center" : "gap-3"} ${active ? "border-[color-mix(in_srgb,var(--brand)_30%,var(--border-subtle))] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"}`}
        >
          <NavigationIcon name={item.icon} />
          {collapsed ? null : <span>{item.label}</span>}
        </Link>
      );
    });
  return (
    <aside data-collapsed={collapsed} className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--background-raised)] lg:flex ${collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]"}`} aria-label={copy.academyNav}>
      <div className="flex min-h-[var(--topbar-height)] items-center border-b border-[var(--border-subtle)] px-4"><BrandMark compact={collapsed} /></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <nav aria-label={copy.primary} className="space-y-1">{renderItems(primaryNavigation(dictionary))}</nav>
        <div className="h-px bg-[var(--border-subtle)]" />
        <nav aria-label={copy.details} className="space-y-1">{renderItems(secondaryNavigation(dictionary))}</nav>
        {collapsed ? null : (
          <div className="space-y-3 pt-3">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        )}
      </div>
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? copy.expand : copy.collapse} className="m-3 flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
        {collapsed ? <ChevronRight aria-hidden="true" size={17} /> : <><ChevronLeft aria-hidden="true" size={17} /> <span>{copy.compact}</span></>}
      </button>
    </aside>
  );
}
