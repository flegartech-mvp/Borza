"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--background)] p-6">
      <section className="panel max-w-md p-7 text-center">
        <p className="text-sm font-semibold text-[var(--negative)]">
          Dashboard error
        </p>
        <h1 className="mt-2 text-xl font-semibold">
          Market context could not be displayed.
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Retry the page. If the problem continues, verify the frontend and API
          configuration.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] active:translate-y-px"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
