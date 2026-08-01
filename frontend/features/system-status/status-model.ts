import type { IngestionStatus } from "@/lib/types";

export type SystemStatusTone = "loading" | "current" | "degraded" | "offline";

export type SystemStatusSummary = {
  tone: SystemStatusTone;
  label: string;
  detail: string;
  demo: boolean;
};

export function summarizeSystemStatus(
  ingestion: IngestionStatus | null,
  options: { failed: boolean; online: boolean },
): SystemStatusSummary {
  if (!options.online) {
    return {
      tone: "offline",
      label: "Offline",
      detail:
        "The browser is offline. Previously loaded data may still be visible.",
      demo: ingestion?.provider === "demo",
    };
  }

  if (options.failed) {
    return {
      tone: "offline",
      label: "Status unavailable",
      detail: "Borza could not confirm ingestion freshness.",
      demo: ingestion?.provider === "demo",
    };
  }

  if (!ingestion) {
    return {
      tone: "loading",
      label: "Checking data",
      detail: "Confirming provider and ingestion freshness.",
      demo: false,
    };
  }

  const demo = ingestion.provider === "demo";
  const degraded =
    ingestion.status !== "complete" ||
    ingestion.worker_status === "stale" ||
    !ingestion.last_successful_at;

  if (degraded) {
    return {
      tone: "degraded",
      label: demo ? "Demo · degraded" : "Data degraded",
      detail:
        ingestion.status === "partial"
          ? "The latest ingestion completed with partial provider coverage."
          : ingestion.status === "never_run"
            ? "No successful ingestion has been recorded."
            : `Latest ingestion status: ${ingestion.status}.`,
      demo,
    };
  }

  return {
    tone: "current",
    label: demo ? "Demo · current" : "Data current",
    detail: demo
      ? "The current workspace uses labeled simulated stories."
      : "The latest ingestion completed successfully.",
    demo,
  };
}
