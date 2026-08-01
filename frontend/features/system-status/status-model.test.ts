import { describe, expect, it } from "vitest";
import type { IngestionStatus } from "@/lib/types";
import { summarizeSystemStatus } from "./status-model";

const complete: IngestionStatus = {
  status: "complete",
  provider: "gdelt",
  worker_status: "ready",
  last_started_at: "2026-07-29T10:00:00Z",
  last_completed_at: "2026-07-29T10:01:00Z",
  last_successful_at: "2026-07-29T10:01:00Z",
  records_inserted: 8,
};

describe("summarizeSystemStatus", () => {
  it("reports current live data", () => {
    expect(
      summarizeSystemStatus(complete, { failed: false, online: true }),
    ).toMatchObject({ tone: "current", label: "Data current", demo: false });
  });

  it("keeps demo mode explicit", () => {
    expect(
      summarizeSystemStatus(
        { ...complete, provider: "demo" },
        { failed: false, online: true },
      ),
    ).toMatchObject({ tone: "current", label: "Demo · current", demo: true });
  });

  it("distinguishes degraded and offline states", () => {
    expect(
      summarizeSystemStatus(
        { ...complete, status: "partial" },
        { failed: false, online: true },
      ).tone,
    ).toBe("degraded");
    expect(
      summarizeSystemStatus(complete, { failed: false, online: false }).tone,
    ).toBe("offline");
  });
});
