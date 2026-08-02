"use client";

import Link from "next/link";
import { usePreferences } from "@/features/preferences";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { dictionary } = usePreferences();
  return (
    <Link href="/" aria-label={dictionary.brand.name} className="inline-flex min-w-0 items-center gap-3 rounded-[var(--radius-sm)]">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] border border-[color-mix(in_srgb,var(--brand)_42%,transparent)] bg-[var(--brand-soft)] font-mono text-base font-bold text-[var(--brand)]">
        B
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold tracking-[0.13em]">BORZA ACADEMY</span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--text-tertiary)]">{dictionary.brand.tagline}</span>
        </span>
      )}
    </Link>
  );
}
