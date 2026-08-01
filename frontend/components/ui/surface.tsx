import type { HTMLAttributes } from "react";
import { classNames } from "@/lib/class-names";

export type SurfaceLevel = 1 | 2 | 3;
export type SurfacePadding = "none" | "sm" | "md" | "lg";
export type SurfaceElement = "div" | "section" | "article" | "aside";

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  level?: SurfaceLevel;
  padding?: SurfacePadding;
};

const levelClasses = {
  1: "bg-[var(--surface-1)]",
  2: "bg-[var(--surface-2)]",
  3: "bg-[var(--surface-3)]",
} satisfies Record<SurfaceLevel, string>;

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
} satisfies Record<SurfacePadding, string>;

export function Surface({
  as: Element = "div",
  className,
  level = 1,
  padding = "md",
  ...props
}: SurfaceProps) {
  return (
    <Element
      {...props}
      className={classNames(
        "rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[var(--text-primary)]",
        levelClasses[level],
        paddingClasses[padding],
        className,
      )}
      data-surface-level={level}
    />
  );
}
