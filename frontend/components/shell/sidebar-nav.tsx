"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ServerCog } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { NavigationIcon } from "./navigation-icon";
import {
  FUTURE_NAVIGATION,
  isNavigationItemActive,
  PRIMARY_NAVIGATION,
} from "@/lib/navigation";
import { usePathname } from "next/navigation";
import { ExperienceSwitcher, ThemeSwitcher } from "@/features/preferences";

const SIDEBAR_STORAGE_KEY = "borza-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "borza:sidebar-change";

function subscribeToSidebarPreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange);
  };
}

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function SidebarNav() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    readSidebarPreference,
    () => false,
  );

  const updateCollapsed = (next: boolean) => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // The preference is optional; navigation remains usable without storage.
    }
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  };

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-1)] transition-[width] duration-200 lg:flex ${
        collapsed
          ? "w-[var(--sidebar-collapsed-width)]"
          : "w-[var(--sidebar-width)]"
      }`}
      aria-label="Workspace sidebar"
    >
      <div className="flex min-h-[var(--topbar-height)] items-center border-b border-[var(--border-subtle)] px-4">
        <BrandMark compact={collapsed} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        {collapsed ? null : (
          <div className="mb-4">
            <p className="mb-2 px-1 text-xs font-medium text-[var(--text-tertiary)]">
              Experience
            </p>
            <ExperienceSwitcher />
          </div>
        )}

        <nav aria-label="Primary navigation" className="space-y-1">
          {PRIMARY_NAVIGATION.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`group flex min-h-11 items-center rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center" : "gap-3"
                } ${
                  active
                    ? "border-[color-mix(in_srgb,var(--brand)_35%,var(--border-subtle))] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                }`}
              >
                <NavigationIcon name={item.icon} className="shrink-0" />
                {collapsed ? null : <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="my-4 h-px bg-[var(--border-subtle)]" />

        {collapsed ? (
          <p className="sr-only">Future workspaces</p>
        ) : (
          <p className="mb-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">
            Future workspaces
          </p>
        )}
        <nav aria-label="Preview workspaces" className="space-y-1">
          {FUTURE_NAVIGATION.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? `${item.label} · Preview` : undefined}
                className={`flex min-h-11 items-center rounded-[var(--radius-sm)] border px-3 text-sm transition-colors ${
                  collapsed ? "justify-center" : "gap-3"
                } ${
                  active
                    ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                }`}
              >
                <NavigationIcon name={item.icon} className="shrink-0" />
                {collapsed ? null : (
                  <>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px]">
                      Preview
                    </span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-5">
          <div
            className={`rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-3 text-[var(--text-tertiary)] ${
              collapsed ? "grid place-items-center" : ""
            }`}
          >
            <ServerCog aria-hidden="true" size={17} className="shrink-0" />
            {collapsed ? null : (
              <p className="mt-2 text-xs leading-5">
                Self-hosted workspace. Data states remain source-labeled.
              </p>
            )}
          </div>
          {collapsed ? null : (
            <div className="mt-3">
              <p className="mb-2 px-1 text-xs font-medium text-[var(--text-tertiary)]">
                Appearance
              </p>
              <ThemeSwitcher />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] p-3">
        <button
          type="button"
          onClick={() => updateCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex min-h-10 w-full items-center rounded-[var(--radius-sm)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] ${
            collapsed ? "justify-center" : "gap-3 px-3"
          }`}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" size={17} />
          ) : (
            <>
              <ChevronLeft aria-hidden="true" size={17} />
              Collapse sidebar
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
