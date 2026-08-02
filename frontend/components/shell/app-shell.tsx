"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { WorkspaceHeader } from "./workspace-header";
import { shellCopy } from "./shell-copy";

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const { mode } = useDemoWorkspace();
  const { dictionary, language } = usePreferences();
  const copy = shellCopy[language];
  return (
    <div className="flex min-h-dvh bg-[var(--background)] text-[var(--text-primary)]">
      <a href="#academy-content" className="fixed left-3 top-3 z-50 -translate-y-24 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 py-2 font-semibold text-[var(--brand-contrast)] focus:translate-y-0">{copy.skip}</a>
      <SidebarNav />
      <div className="min-w-0 flex-1">
        <WorkspaceHeader />
        <main id="academy-content" tabIndex={-1} className={`mx-auto w-full px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 md:pb-10 lg:px-6 ${wide || pathname.startsWith("/simulator") || pathname.startsWith("/practice") || pathname.startsWith("/lesson") ? "max-w-[1780px]" : "max-w-[1480px]"}`}>
          {mode === "demo" ? <div className="mb-4 inline-flex rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">{dictionary.common.localDemo} · {copy.local}</div> : null}
          {children}
          <footer className="mt-12 border-t border-[var(--border-subtle)] py-6 text-center text-xs leading-5 text-[var(--text-tertiary)]">{dictionary.landing.responsible}</footer>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
