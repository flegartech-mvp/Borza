import type { ReactNode } from "react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { WorkspaceHeader } from "./workspace-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-[var(--background)] text-[var(--text-primary)]">
      <a
        href="#workspace-content"
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 py-2 font-semibold text-[var(--brand-contrast)] transition-transform focus:translate-y-0"
      >
        Zum Arbeitsbereich springen
      </a>
      <SidebarNav />
      <div className="min-w-0 flex-1">
        <WorkspaceHeader />
        <main
          id="workspace-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1680px] px-3 pb-[calc(76px+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-5 md:pb-8 lg:px-6"
        >
          {children}
          <footer className="mt-10 border-t border-[var(--border-subtle)] py-6 text-center text-xs leading-5 text-[var(--text-tertiary)]">
            Borza bietet Informationsanalysen, keine Anlageberatung. Artikelton,
            abgeleitete Geografie und Aufmerksamkeitswerte können ungenau sein
            und sagen keine Kursbewegung voraus.
          </footer>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
