import Link from "next/link";

export function BrandMark({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Borza overview"
      className={`inline-flex min-w-0 items-center gap-3 rounded-[var(--radius-sm)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-[color-mix(in_srgb,var(--brand)_42%,transparent)] bg-[var(--brand-soft)] font-mono text-base font-bold text-[var(--brand)]"
      >
        B
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-[0.16em] text-[var(--text-primary)]">
            BORZA
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]">
            Financial intelligence
          </span>
        </span>
      )}
    </Link>
  );
}
