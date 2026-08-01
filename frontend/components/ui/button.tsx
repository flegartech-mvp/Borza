import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/class-names";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border font-semibold transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses = {
  primary:
    "border-transparent bg-[var(--brand)] text-[var(--brand-contrast)] hover:bg-[var(--brand-strong)]",
  secondary:
    "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-3)]",
  ghost:
    "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--brand-soft)] hover:text-[var(--text-primary)]",
  danger:
    "border-[var(--negative)] bg-[var(--negative-soft)] text-[var(--negative)] hover:border-[var(--border-strong)]",
} satisfies Record<ButtonVariant, string>;

const sizeClasses = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-base",
} satisfies Record<ButtonSize, string>;

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={classNames(
        "size-4 shrink-0 animate-spin motion-reduce:animate-none",
        className,
      )}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function ButtonContent({
  children,
  loading,
  loadingLabel,
}: {
  children: ReactNode;
  loading: boolean;
  loadingLabel: string;
}) {
  if (!loading) return children;

  return (
    <>
      <LoadingSpinner />
      <span>{loadingLabel}</span>
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      "aria-label": ariaLabel,
      children,
      className,
      disabled,
      loading = false,
      loadingLabel = "Loading",
      size = "md",
      type = "button",
      variant = "primary",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingLabel : ariaLabel}
        className={classNames(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        data-loading={loading || undefined}
        data-size={size}
        data-variant={variant}
        disabled={disabled || loading}
      >
        <ButtonContent loading={loading} loadingLabel={loadingLabel}>
          {children}
        </ButtonContent>
      </button>
    );
  },
);
