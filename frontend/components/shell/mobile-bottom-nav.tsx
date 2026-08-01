"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavigationItemActive, PRIMARY_NAVIGATION } from "@/lib/navigation";
import { NavigationIcon } from "./navigation-icon";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-1)_96%,transparent)] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgb(0_0_0_/_14%)] backdrop-blur md:hidden"
    >
      {PRIMARY_NAVIGATION.map((item) => {
        const active = isNavigationItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${
              active ? "text-[var(--brand)]" : "text-[var(--text-tertiary)]"
            }`}
          >
            <NavigationIcon name={item.icon} size={18} />
            <span>{item.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
