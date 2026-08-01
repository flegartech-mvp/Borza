import type { EndpointState, IngestionStatus } from "@/lib/types";

type NewsFreshnessPanelProps = {
  state: EndpointState<IngestionStatus>;
  referenceTime?: string;
};

export function NewsFreshnessPanel({
  state,
  referenceTime,
}: NewsFreshnessPanelProps) {
  if (state.phase === "idle") return null;

  const ingestion = state.data;
  const lastSuccessfulAt = ingestion?.last_successful_at
    ? Date.parse(ingestion.last_successful_at)
    : Number.NaN;
  const referenceTimestamp = Date.parse(referenceTime ?? "");
  const stale =
    Number.isFinite(lastSuccessfulAt) &&
    Number.isFinite(referenceTimestamp) &&
    referenceTimestamp - lastSuccessfulAt > 30 * 60 * 60 * 1000;
  const degraded =
    state.error !== null ||
    ingestion?.status === "never_run" ||
    ingestion?.status === "failed" ||
    ingestion?.status === "partial" ||
    ingestion?.status === "cancelled" ||
    ingestion?.worker_status === "stale" ||
    (ingestion !== null && !Number.isFinite(lastSuccessfulAt)) ||
    stale;

  return (
    <section
      className={`mt-3 border px-4 py-3 text-xs ${
        degraded
          ? "border-[var(--warning-line)] bg-[var(--warning-soft)]"
          : "border-[var(--line)] bg-[var(--panel)]"
      }`}
      aria-label="News freshness"
      role={degraded ? "status" : undefined}
    >
      {state.phase === "loading" && !ingestion ? (
        <span>Loading news freshness…</span>
      ) : (
        <>
          <p>
            <span className="font-semibold">
              {degraded
                ? "Degraded news freshness."
                : "News ingestion is current."}
            </span>{" "}
            Last successful run:{" "}
            {ingestion?.last_successful_at
              ? new Date(ingestion.last_successful_at).toLocaleString()
              : "not available"}
            . Provider: {ingestion?.provider ?? "unknown"}. Status:{" "}
            {state.error ? state.error.message : ingestion?.status}
            {ingestion?.worker_status
              ? `. Worker: ${ingestion.worker_status}`
              : ""}
            .
          </p>
          {ingestion ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-[var(--line)] pt-3 sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Job
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.job_id ? `#${ingestion.job_id}` : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Queue
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.queue_status ?? "unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Requests
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.request_count ?? "unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Successful windows
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.successful_windows ?? "unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Failed windows
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.failed_windows ?? "unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Warnings
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.warning_count ?? "unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Inserted
                </dt>
                <dd className="mt-0.5 font-mono">
                  {ingestion.records_inserted}
                </dd>
              </div>
            </dl>
          ) : null}
        </>
      )}
    </section>
  );
}
