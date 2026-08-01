export default function Loading() {
  return (
    <main className="min-h-[100dvh] bg-[var(--background)] p-4">
      <div className="mx-auto max-w-[1540px] animate-pulse space-y-3">
        <div className="h-16 border border-[var(--line)] bg-[var(--panel)]" />
        <div className="grid border border-[var(--line)] sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-20 border-b border-[var(--line)] bg-[var(--panel-soft)] sm:border-r"
            />
          ))}
        </div>
        <div className="h-[560px] border border-[var(--line)] bg-[var(--panel-soft)]" />
      </div>
    </main>
  );
}
