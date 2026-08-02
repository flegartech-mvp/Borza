"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { LanguageSwitcher, usePreferences } from "@/features/preferences";
import { pageTitle } from "@/lib/navigation";
import { BrandMark } from "./brand-mark";

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { dictionary } = usePreferences();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex min-h-[var(--topbar-height)] items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] px-3 backdrop-blur sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="lg:hidden">
          <BrandMark compact />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {pageTitle(pathname, dictionary)}
          </h1>
          <p className="hidden text-xs text-[var(--text-tertiary)] sm:block">
            {user ? user.email : dictionary.common.localDemo}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher compact />
        {user ? (
          <Link
            href="/profile"
            className="grid size-10 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
            aria-label={dictionary.nav.profile}
          >
            {(user.email?.[0] ?? "B").toUpperCase()}
          </Link>
        ) : (
          <Link
            href="/sign-in"
            aria-label={dictionary.auth.signIn}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 text-sm font-medium"
          >
            <LogIn aria-hidden="true" size={16} />
            <span className="hidden sm:inline">{dictionary.auth.signIn}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
