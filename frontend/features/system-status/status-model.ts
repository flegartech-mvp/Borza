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
        "Der Browser ist offline. Zuvor geladene Daten können weiterhin sichtbar sein.",
      demo: ingestion?.provider === "demo",
    };
  }

  if (options.failed) {
    return {
      tone: "offline",
      label: "Status nicht verfügbar",
      detail: "Borza konnte die Aktualität des Datenabrufs nicht bestätigen.",
      demo: ingestion?.provider === "demo",
    };
  }

  if (!ingestion) {
    return {
      tone: "loading",
      label: "Daten werden geprüft",
      detail: "Anbieter und Aktualität des Datenabrufs werden geprüft.",
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
      label: demo ? "Demo · eingeschränkt" : "Daten eingeschränkt",
      detail:
        ingestion.status === "partial"
          ? "Der letzte Abruf wurde mit partieller Anbieterabdeckung abgeschlossen."
          : ingestion.status === "never_run"
            ? "Es wurde noch kein erfolgreicher Abruf aufgezeichnet."
            : `Letzter Abrufstatus: ${ingestion.status}.`,
      demo,
    };
  }

  return {
    tone: "current",
    label: demo ? "Demo · aktuell" : "Daten aktuell",
    detail: demo
      ? "Der aktuelle Arbeitsbereich nutzt gekennzeichnete simulierte Meldungen."
      : "Der letzte Datenabruf wurde erfolgreich abgeschlossen.",
    demo,
  };
}
