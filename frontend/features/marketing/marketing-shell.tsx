"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import {
  LanguageSwitcher,
  ThemeSwitcher,
  usePreferences,
} from "@/features/preferences";

const navigation = {
  de: {
    learn: "Lernen",
    schools: "Für Schulen",
    impact: "Wirkung",
    signIn: "Anmelden",
  },
  sl: {
    learn: "Učenje",
    schools: "Za šole",
    impact: "Učinek",
    signIn: "Prijava",
  },
  en: {
    learn: "Learn",
    schools: "For schools",
    impact: "Impact",
    signIn: "Sign in",
  },
} as const;

const footer = {
  de: {
    statement:
      "Finanzbildung für bessere Entscheidungen – ohne Gewinnversprechen oder Echtgeld-Handel.",
    boundary:
      "Bildungsangebot, keine Finanzberatung. Alle Marktszenarien sind klar als Simulation gekennzeichnet.",
  },
  sl: {
    statement:
      "Finančno izobraževanje za boljše odločitve – brez obljub dobička ali trgovanja s pravim denarjem.",
    boundary:
      "Izobraževalna vsebina, ne finančno svetovanje. Vsi tržni scenariji so jasno označeni kot simulacije.",
  },
  en: {
    statement:
      "Financial education for better decisions—with no profit promises or real-money trading.",
    boundary:
      "Education, not financial advice. Every market scenario is clearly labelled as simulated.",
  },
} as const;

export function MarketingHeader() {
  const { language } = usePreferences();
  const copy = navigation[language];
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandMark />
        <nav aria-label="Public" className="hidden items-center gap-6 md:flex">
          <Link
            className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/learn"
          >
            {copy.learn}
          </Link>
          <Link
            className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/schools"
          >
            {copy.schools}
          </Link>
          <Link
            className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/impact"
          >
            {copy.impact}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <ThemeSwitcher />
          </div>
          <LanguageSwitcher compact />
          <Link
            href="/sign-in"
            className="hidden min-h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 text-sm font-semibold sm:inline-flex"
          >
            {copy.signIn}
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const { language } = usePreferences();
  const copy = footer[language];
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--background-raised)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_.8fr]">
        <div>
          <BrandMark />
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            {copy.statement}
          </p>
        </div>
        <div className="text-sm leading-6 text-[var(--text-tertiary)] md:text-right">
          <p>{copy.boundary}</p>
          <div className="mt-3 flex flex-wrap gap-4 md:justify-end">
            <Link href="/schools">Schools</Link>
            <Link href="/impact">Impact</Link>
            <Link href="/learn">Academy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main id="main-content">{children}</main>
      <MarketingFooter />
    </>
  );
}
