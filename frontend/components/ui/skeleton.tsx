import type { HTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export type SkeletonRadius = "sm" | "md" | "lg" | "full";

export type SkeletonProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children"
> & {
  label?: string;
  radius?: SkeletonRadius;
};

const radiusClasses = {
  sm: "rounded-[var(--radius-sm)]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  full: "rounded-full",
} satisfies Record<SkeletonRadius, string>;

export function Skeleton({
  className,
  label,
  radius = "md",
  ...props
}: SkeletonProps) {
  return (
    <div
      {...props}
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={classNames(
        "animate-pulse bg-[var(--surface-3)] motion-reduce:animate-none",
        radiusClasses[radius],
        className,
      )}
    />
  );
}
