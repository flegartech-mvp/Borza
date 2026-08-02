import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/class-names";

type StateKind = "empty" | "error" | "degraded";

type StateMessageProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  action?: ReactNode;
  description?: ReactNode;
  title: string;
};

const stateClasses = {
  empty:
    "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]",
  error:
    "border-[var(--negative)] bg-[var(--negative-soft)] text-[var(--negative)]",
  degraded:
    "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
} satisfies Record<StateKind, string>;

function StateIcon({ kind }: { kind: StateKind }) {
  if (kind === "empty") {
    return (
      <svg
        aria-hidden="true"
        className="size-6"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M4 7.5h6l1.5 2H20v8.5H4V7.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (kind === "error") {
    return (
      <svg
        aria-hidden="true"
        className="size-6"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="m9 9 6 6m0-6-6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path
        d="m12 4 8 15H4L12 4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M12 9v4.5m0 2.5v.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function StateMessage({
  action,
  className,
  description,
  kind,
  title,
  ...props
}: StateMessageProps & { kind: StateKind }) {
  const titleId = useId();
  const role = kind === "error" ? "alert" : "status";

  return (
    <div
      {...props}
      role={role}
      aria-labelledby={titleId}
      className={classNames(
        "flex min-h-40 flex-col items-center justify-center rounded-[var(--radius-md)] border px-5 py-8 text-center",
        stateClasses[kind],
        className,
      )}
      data-state={kind}
    >
      <StateIcon kind={kind} />
      <h2
        id={titleId}
        className="mt-3 text-base font-semibold text-[var(--text-primary)]"
      >
        {title}
      </h2>
      {description ? (
        <div className="mt-1 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export type EmptyStateProps = StateMessageProps;
export type ErrorStateProps = StateMessageProps;
export type DegradedStateProps = StateMessageProps;

export function EmptyState(props: EmptyStateProps) {
  return <StateMessage {...props} kind="empty" />;
}

export function ErrorState(props: ErrorStateProps) {
  return <StateMessage {...props} kind="error" />;
}

export function DegradedState(props: DegradedStateProps) {
  return <StateMessage {...props} kind="degraded" />;
}
