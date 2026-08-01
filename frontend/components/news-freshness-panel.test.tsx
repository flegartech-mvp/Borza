// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NewsFreshnessPanel } from "./news-freshness-panel";
import type { EndpointState, IngestionStatus } from "@/lib/types";

const ingestion: IngestionStatus = {
  status: "partial",
  provider: "opennews",
  job_id: 42,
  queue_status: "complete",
  worker_status: "ready",
  last_started_at: "2026-07-29T09:00:00Z",
  last_completed_at: "2026-07-29T09:02:00Z",
  last_successful_at: "2026-07-29T09:02:00Z",
  records_inserted: 18,
  request_count: 6,
  successful_windows: 4,
  failed_windows: 2,
  warning_count: 1,
};

afterEach(cleanup);

describe("NewsFreshnessPanel", () => {
  it("shows queue identity and ingestion coverage counters", () => {
    const state: EndpointState<IngestionStatus> = {
      data: ingestion,
      phase: "ready",
      error: null,
      lastSuccessAt: Date.now(),
    };
    render(
      <NewsFreshnessPanel state={state} referenceTime="2026-07-29T10:00:00Z" />,
    );

    const panel = screen.getByLabelText("Nachrichtenaktualität");
    const valueFor = (label: string) =>
      within(panel).getByText(label).nextElementSibling;
    expect(valueFor("Auftrag")).toHaveTextContent("#42");
    expect(valueFor("Warteschlange")).toHaveTextContent("complete");
    expect(valueFor("Anfragen")).toHaveTextContent("6");
    expect(valueFor("Erfolgreiche Fenster")).toHaveTextContent("4");
    expect(valueFor("Fehlgeschlagene Fenster")).toHaveTextContent("2");
    expect(valueFor("Warnungen")).toHaveTextContent("1");
    expect(valueFor("Eingefügt")).toHaveTextContent("18");
  });

  it("keeps prior operator data visible when freshness refresh fails", () => {
    const state: EndpointState<IngestionStatus> = {
      data: ingestion,
      phase: "error",
      error: {
        kind: "unavailable",
        endpoint: "news freshness",
        message: "Freshness endpoint unavailable",
      },
      lastSuccessAt: Date.now(),
    };
    render(<NewsFreshnessPanel state={state} />);

    const panel = screen.getByRole("status", {
      name: "Nachrichtenaktualität",
    });
    expect(panel).toHaveTextContent("Freshness endpoint unavailable");
    expect(
      within(panel).getByText("Erfolgreiche Fenster").nextElementSibling,
    ).toHaveTextContent("4");
    expect(
      within(panel).getByText("Fehlgeschlagene Fenster").nextElementSibling,
    ).toHaveTextContent("2");
  });
});
