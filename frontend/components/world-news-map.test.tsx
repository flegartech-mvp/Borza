// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldNewsMap } from "./world-news-map";
import {
  GLOBAL_SELECTION,
  makeCountrySelection,
  REGION_OPTIONS,
  type GeographySelection,
} from "@/lib/geography";
import type { Article } from "@/lib/types";

const chinaStory: Article = {
  id: 1,
  external_id: "china-story",
  title: "China production update",
  description: "",
  article_url: "https://example.com/china",
  source: "Example News",
  published_at: "2026-07-27T12:00:00Z",
  sentiment: "positive",
  sentiment_confidence: 0.8,
  positive_probability: 0.8,
  negative_probability: 0.1,
  neutral_probability: 0.1,
  impact_score: 70,
  urgency: "high",
  tickers: [],
  country_code: "CN",
  country_name: "China",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorldNewsMap direct SVG renderer", () => {
  it("renders visual-only TopoJSON paths and preserves hover and pointer selection", () => {
    const onSelectionChange = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(
      <WorldNewsMap
        articles={[chinaStory]}
        selection={GLOBAL_SELECTION}
        onSelectionChange={onSelectionChange}
      />,
    );

    const map = container.querySelector("svg");
    const china = container.querySelector(
      '[data-country-name="China"]',
    ) as SVGPathElement;
    expect(map).toHaveAttribute("aria-hidden", "true");
    expect(map).toHaveAttribute("focusable", "false");
    expect(map?.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(map?.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(china).toHaveAttribute("data-country-selectable", "true");

    fireEvent.mouseEnter(china);
    expect(screen.getByText("Average attention score 70")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.pointerUp(china as Element);
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "country",
        countryCode: "CN",
        label: "China",
      }),
    );
  });

  it("supports region selection and the visible Global reset control", async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WorldNewsMap
        articles={[chinaStory]}
        selection={makeCountrySelection("156", "China")}
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(
      within(screen.getByLabelText("Map region filters")).getByRole("button", {
        name: "Europe",
      }),
    );
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "region",
        region: "europe",
        label: "Europe",
      }),
    );

    await user.click(screen.getByRole("button", { name: /reset to global/i }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(GLOBAL_SELECTION);
  });

  it("uses one native selector as the primary keyboard country interaction", async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulWorldNewsMap />);

    const selector = screen.getByRole("combobox", { name: "Select a country" });
    const regionButtons = within(
      screen.getByLabelText("Map region filters"),
    ).getAllByRole("button");
    expect(regionButtons).toHaveLength(REGION_OPTIONS.length);
    for (const button of regionButtons) {
      await user.tab();
      expect(button).toHaveFocus();
    }
    await user.tab();
    expect(selector).toHaveFocus();
    expect(selector).toHaveClass(
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-[var(--accent)]",
    );
    expect(selector).toHaveAccessibleDescription(
      "Global scope selected. Use the Country selector to focus one country.",
    );

    await user.selectOptions(selector, "156");
    expect(selector).toHaveValue("156");
    const summary = screen.getByRole("status");
    expect(summary).toHaveAttribute("aria-live", "polite");
    expect(summary).toHaveAttribute("aria-atomic", "true");
    expect(summary).toHaveTextContent(
      "China selected. 1 story. Mostly positive article tone. Average attention score 70.",
    );
    expect(selector).toHaveAccessibleDescription(summary.textContent ?? "");
    expect(container.querySelectorAll("svg [tabindex]")).toHaveLength(0);
  });

  it("discloses inferred country mappings in the country tooltip", () => {
    render(
      <WorldNewsMap
        articles={[
          { ...chinaStory, country_code: undefined, country_name: undefined },
        ]}
        selection={GLOBAL_SELECTION}
        onSelectionChange={vi.fn()}
      />,
    );

    const china = document.querySelector(
      '[data-country-name="China"]',
    ) as SVGPathElement;
    fireEvent.mouseEnter(china);
    expect(screen.getByText("1 of 1 mappings inferred")).toBeInTheDocument();
  });

  it("has no automated axe violations in the accessible interaction surface", async () => {
    const { container } = render(<StatefulWorldNewsMap />);
    const result = await axe.run(container, {
      rules: {
        // jsdom cannot calculate rendered color contrast; focus visibility is asserted above.
        "color-contrast": { enabled: false },
      },
    });
    expect(result.violations).toEqual([]);
  }, 15_000);
});

function StatefulWorldNewsMap() {
  const [selection, setSelection] =
    useState<GeographySelection>(GLOBAL_SELECTION);
  return (
    <WorldNewsMap
      articles={[chinaStory]}
      selection={selection}
      onSelectionChange={setSelection}
    />
  );
}
