import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/class-names";

export type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4;
  title: ReactNode;
};

const headings = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
} as const;

const headingClasses = {
  1: "text-2xl sm:text-3xl",
  2: "text-xl sm:text-2xl",
  3: "text-lg sm:text-xl",
  4: "text-base sm:text-lg",
} satisfies Record<NonNullable<SectionHeaderProps["headingLevel"]>, string>;

export function SectionHeader({
  actions,
  className,
  description,
  eyebrow,
  headingLevel = 2,
  title,
  ...props
}: SectionHeaderProps) {
  const Heading = headings[headingLevel];

  return (
    <header
      {...props}
      className={classNames(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {eyebrow}
          </p>
        ) : null}
        <Heading
          className={classNames(
            "font-semibold tracking-tight text-[var(--text-primary)]",
            headingClasses[headingLevel],
          )}
        >
          {title}
        </Heading>
        {description ? (
          <div className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-h-10 shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
