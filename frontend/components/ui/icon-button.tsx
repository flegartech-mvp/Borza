import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoadingSpinner } from "./button";
import type { ButtonSize, ButtonVariant } from "./button";
import { classNames } from "@/lib/class-names";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  "aria-label": string;
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60";

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
  sm: "size-10",
  md: "size-10",
  lg: "size-11",
} satisfies Record<ButtonSize, string>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      "aria-label": ariaLabel,
      children,
      className,
      disabled,
      loading = false,
      loadingLabel = `${ariaLabel}, loading`,
      size = "md",
      type = "button",
      variant = "ghost",
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
        {loading ? <LoadingSpinner /> : children}
      </button>
    );
  },
);
