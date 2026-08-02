"use client";

import Link from "next/link";
import { MoreHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { usePreferences } from "@/features/preferences";
import {
  isNavigationItemActive,
  mobileNavigation,
  primaryNavigation,
  secondaryNavigation,
} from "@/lib/navigation";
import { NavigationIcon } from "./navigation-icon";
import { shellCopy } from "./shell-copy";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { dictionary, language } = usePreferences();
  const copy = shellCopy[language];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialogRef.current?.close();
  return (
    <>
      <nav
        aria-label={copy.mobile}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-1)_96%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {mobileNavigation(dictionary).map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${active ? "text-[var(--brand)]" : "text-[var(--text-tertiary)]"}`}
            >
              <NavigationIcon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            dialogRef.current?.showModal();
            setOpen(true);
          }}
          className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] text-[var(--text-tertiary)]"
        >
          <MoreHorizontal aria-hidden="true" size={19} />
          {dictionary.common.more}
        </button>
      </nav>
      <dialog
        ref={dialogRef}
        aria-label={dictionary.common.more}
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        className="m-0 mt-auto max-h-[76dvh] w-full max-w-none rounded-t-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] backdrop:bg-[#03070c]/70 md:hidden"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
          <strong>{dictionary.brand.name}</strong>
          <button type="button" onClick={close} aria-label={copy.close}>
            <X aria-hidden="true" />
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-2 p-4">
          {[
            ...primaryNavigation(dictionary).slice(4),
            ...secondaryNavigation(dictionary),
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="flex min-h-14 items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3"
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </dialog>
    </>
  );
}
