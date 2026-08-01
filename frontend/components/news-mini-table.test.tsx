// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewsMiniTable } from "./news-mini-table";
import type { Article } from "@/lib/types";

function article(id: number, overrides: Partial<Article> = {}): Article {
  return {
    id,
    external_id: `article-${id}`,
    title: `Story ${id}`,
    description: "",
    article_url: `https://example.com/articles/${id}`,
    source: "Example News",
    published_at: "2026-07-27T12:00:00Z",
    sentiment: "neutral",
    sentiment_confidence: 0.5,
    positive_probability: 0.2,
    negative_probability: 0.2,
    neutral_probability: 0.6,
    impact_score: 50,
    urgency: "medium",
    tickers: [],
    ...overrides,
  };
}

function setDesktopMediaQuery(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

afterEach(() => cleanup());

describe("NewsMiniTable", () => {
  it("loads the next server page without losing existing stories", async () => {
    setDesktopMediaQuery(false);
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <NewsMiniTable
        articles={Array.from({ length: 12 }, (_, index) => article(index + 1))}
        total={30}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByText(/Showing 12 of 30 matching stories/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    await user.click(
      screen.getByRole("button", { name: "Load next 12 stories" }),
    );
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("updates result scope when the selected geography changes", async () => {
    setDesktopMediaQuery(false);
    const stories = Array.from({ length: 12 }, (_, index) =>
      article(index + 1),
    );
    const view = render(
      <NewsMiniTable
        articles={stories}
        selectionLabel="China"
        resetKey="country-CN"
        total={30}
      />,
    );

    view.rerender(
      <NewsMiniTable
        articles={stories.slice(0, 4)}
        selectionLabel="Europe"
        resetKey="region-europe"
        total={30}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Showing 4 geography matches/)).toBeTruthy(),
    );
    expect(screen.getByText("Europe")).toBeTruthy();
  });

  it("mounts cards on mobile and the information-dense table on desktop", async () => {
    setDesktopMediaQuery(false);
    const mobile = render(<NewsMiniTable articles={[article(1)]} />);
    expect(screen.getByTestId("mobile-news-cards")).toBeTruthy();
    expect(screen.queryByTestId("desktop-news-table")).toBeNull();
    mobile.unmount();

    setDesktopMediaQuery(true);
    render(<NewsMiniTable articles={[article(1)]} />);
    await waitFor(() =>
      expect(screen.getByTestId("desktop-news-table")).toBeTruthy(),
    );
    expect(screen.queryByTestId("mobile-news-cards")).toBeNull();
  });

  it("renders an empty state and does not create a link for invalid demo URLs", () => {
    setDesktopMediaQuery(false);
    const empty = render(
      <NewsMiniTable articles={[]} selectionLabel="Slovenia" />,
    );
    expect(screen.getByText("No stories match Slovenia")).toBeTruthy();
    empty.unmount();

    render(
      <NewsMiniTable
        articles={[article(1, { article_url: "javascript:alert(1)" })]}
        isDemo
      />,
    );
    expect(screen.getByText("Demo")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /open source/i })).toBeNull();
  });
});
