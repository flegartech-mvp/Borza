"use client";

import { Globe2, Moon, Sun } from "lucide-react";
import type { ConnectionStatus as Status } from "@/lib/types";
import { ConnectionStatus } from "./connection-status";

type DashboardHeaderProps = {
  status: Status;
  theme: "dark" | "light";
  onThemeChange: () => void;
};

const navigation = [
  { href: "#regions", label: "World map" },
  { href: "#news", label: "News" },
  { href: "#sectors", label: "Sectors" },
  { href: "#learn", label: "Learn" },
  { href: "#premium", label: "Premium" },
] as const;

export function DashboardHeader({
  status,
  theme,
  onThemeChange,
}: DashboardHeaderProps) {
  return (
    <header className="border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 lg:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-[var(--accent)] text-[var(--accent-contrast)]">
            <Globe2 aria-hidden="true" size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Borza</h1>
            <p className="truncate text-xs text-[var(--muted)]">
              Financial news and market context
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-5 whitespace-nowrap text-xs text-[var(--muted)] md:flex"
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-[var(--foreground)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <span
            className="hidden h-5 w-px bg-[var(--line)] md:block"
            aria-hidden="true"
          />
          <ConnectionStatus status={status} />
          <button
            type="button"
            onClick={onThemeChange}
            aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            className="grid size-9 place-items-center rounded-sm border border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--foreground)] active:translate-y-px"
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" size={16} />
            ) : (
              <Moon aria-hidden="true" size={16} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
