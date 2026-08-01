import type { LucideIcon } from "lucide-react";
import { StatusPill, Surface } from "@/components/ui";

export type PreviewPrinciple = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function WorkspacePreview({
  eyebrow,
  title,
  description,
  principles,
  disclosure,
}: {
  eyebrow: string;
  title: string;
  description: string;
  principles: readonly PreviewPrinciple[];
  disclosure: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="max-w-3xl">
        <StatusPill label="Not available in this release" tone="information" />
        <p className="mt-6 text-xs font-semibold text-[var(--brand)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
          {description}
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {principles.map(
          ({ title: itemTitle, description: body, icon: Icon }) => (
            <Surface key={itemTitle} as="article" level={1} padding="lg">
              <span className="grid size-10 place-items-center rounded-[var(--radius-sm)] bg-[var(--brand-soft)] text-[var(--brand)]">
                <Icon aria-hidden="true" size={18} />
              </span>
              <h3 className="mt-5 text-base font-semibold">{itemTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {body}
              </p>
            </Surface>
          ),
        )}
      </div>

      <Surface
        as="aside"
        level={2}
        padding="lg"
        className="mt-5 text-sm leading-6 text-[var(--text-secondary)]"
      >
        <p className="font-semibold text-[var(--text-primary)]">
          Honest release boundary
        </p>
        <p className="mt-1">{disclosure}</p>
      </Surface>
    </div>
  );
}
