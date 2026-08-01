// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getIngestionStatus } from "@/lib/api";
import { SystemStatusControl } from "./system-status-control";

vi.mock("@/lib/api", () => ({
  getIngestionStatus: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SystemStatusControl", () => {
  it("keeps normal demo freshness compact and exposes provenance on demand", async () => {
    vi.mocked(getIngestionStatus).mockResolvedValue({
      status: "complete",
      provider: "demo",
      worker_status: "ready",
      last_started_at: "2026-07-29T10:00:00Z",
      last_completed_at: "2026-07-29T10:01:00Z",
      last_successful_at: "2026-07-29T10:01:00Z",
      records_inserted: 8,
    });
    const user = userEvent.setup();

    render(<SystemStatusControl />);

    await waitFor(() =>
      expect(
        screen.getByText("Demo · current", { selector: "span" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByText("Demo · current", { selector: "span" }));
    expect(screen.getByText("Last successful ingestion")).toBeInTheDocument();
    expect(screen.getByText("demo", { selector: "dd" })).toBeInTheDocument();
  });
});
