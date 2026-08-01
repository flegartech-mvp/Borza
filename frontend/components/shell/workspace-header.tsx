"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { NavigationIcon } from "./navigation-icon";
import {
  FUTURE_NAVIGATION,
  isNavigationItemActive,
  pageMetadata,
  PRIMARY_NAVIGATION,
} from "@/lib/navigation";
import { SystemStatusControl } from "@/features/system-status/system-status-control";
import { ExperienceSwitcher, ThemeSwitcher } from "@/features/preferences";

export function WorkspaceHeader() {
  const pathname = usePathname();
  const metadata = pageMetadata(pathname);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => {
    dialogRef.current?.close();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-[var(--topbar-height)] items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-3 backdrop-blur sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {metadata.title}
            </h1>
            <p className="hidden truncate text-xs text-[var(--text-tertiary)] sm:block">
              {metadata.context}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden xl:block">
            <ThemeSwitcher />
          </div>
          <SystemStatusControl compact />
          <button
            ref={triggerRef}
            type="button"
            aria-label="Arbeitsbereich-Menü öffnen"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => {
              dialogRef.current?.showModal();
              setMenuOpen(true);
              window.requestAnimationFrame(() =>
                closeButtonRef.current?.focus(),
              );
            }}
            className="grid size-10 place-items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] lg:hidden"
          >
            <Menu aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <dialog
        ref={dialogRef}
        aria-label="Arbeitsbereich-Menü"
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        className="m-0 ml-auto h-dvh max-h-none w-[min(360px,calc(100vw-24px))] max-w-none border-0 border-l border-[var(--border-strong)] bg-[var(--surface-1)] p-0 shadow-[var(--shadow-floating)] backdrop:bg-[#05080b]/70 open:flex open:flex-col"
      >
        <div className="flex min-h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <BrandMark />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Arbeitsbereich-Menü schließen"
            onClick={closeMenu}
            className="grid size-10 place-items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <nav aria-label="Arbeitsbereich-Menünavigation" className="space-y-1">
            {PRIMARY_NAVIGATION.map((item) => {
              const active = isNavigationItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-medium ${
                    active
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <NavigationIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="my-4 h-px bg-[var(--border-subtle)]" />
          <p className="mb-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">
            In dieser Version nicht verfügbar
          </p>
          <nav aria-label="Vorschau-Arbeitsbereiche" className="space-y-1">
            {FUTURE_NAVIGATION.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                aria-current={
                  isNavigationItemActive(pathname, item.href)
                    ? "page"
                    : undefined
                }
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              >
                <NavigationIcon name={item.icon} />
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                  Vorschau
                </span>
              </Link>
            ))}
          </nav>

          <div className="my-4 h-px bg-[var(--border-subtle)]" />
          <div className="space-y-4 px-3">
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">
                Ansicht
              </p>
              <ExperienceSwitcher />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">
                Darstellung
              </p>
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
