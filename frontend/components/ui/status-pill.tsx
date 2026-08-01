import type { HTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export type StatusTone = "positive" | "negative" | "warning" | "information";

export type StatusPillProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  label: string;
  tone: StatusTone;
};

const toneClasses = {
  positive:
    "border-[var(--positive)] bg-[var(--positive-soft)] text-[var(--positive)]",
  negative:
    "border-[var(--negative)] bg-[var(--negative-soft)] text-[var(--negative)]",
  warning:
    "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
  information:
    "border-[var(--information)] bg-[var(--status-soft)] text-[var(--information)]",
} satisfies Record<StatusTone, string>;

function StatusIcon({ tone }: { tone: StatusTone }) {
  if (tone === "positive") {
    return (
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="m4 8.25 2.4 2.4L12 5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (tone === "negative") {
    return (
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="m5 5 6 6m0-6-6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg
        aria-hidden="true"
        className="size-3.5 shrink-0"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M8 5v3.5m0 2.25v.1M2.6 12.5 7 3.3a1.1 1.1 0 0 1 2 0l4.4 9.2H2.6Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 7.25v3M8 5.1v.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function StatusPill({
  className,
  label,
  tone,
  ...props
}: StatusPillProps) {
  return (
    <span
      {...props}
      className={classNames(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      data-tone={tone}
    >
      <StatusIcon tone={tone} />
      <span>{label}</span>
    </span>
  );
}
