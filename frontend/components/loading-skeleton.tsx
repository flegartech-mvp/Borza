export function LoadingSkeleton() {
  return (
    <section className="mt-5 space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="panel h-40 animate-pulse rounded-xl bg-[var(--panel)]"
        />
      ))}
    </section>
  );
}
