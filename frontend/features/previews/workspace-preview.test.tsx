// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PaperPreviewPage from "@/app/(workspace)/paper/page";
import StudyPreviewPage from "@/app/(workspace)/study/page";

afterEach(cleanup);

describe("future workspace previews", () => {
  it("describes Study without fake courses, progress, or affiliation", () => {
    const { container } = render(<StudyPreviewPage />);
    expect(
      screen.getByText("Not available in this release"),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("No uploads, courses");
    expect(container).toHaveTextContent("not affiliated");
    expect(container.textContent).not.toMatch(/\b\d+%\b/);
  });

  it("describes Paper Trading without fake balances or performance", () => {
    const { container } = render(<PaperPreviewPage />);
    expect(container).toHaveTextContent("no balances, positions, orders");
    expect(container).toHaveTextContent("not execute live trades");
    expect(container.textContent).not.toMatch(/[$€£]\s?\d/);
    expect(container.textContent).not.toMatch(/\bP&L\b/i);
  });
});
