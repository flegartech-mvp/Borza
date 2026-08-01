// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Button,
  DegradedState,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  StatusPill,
} from "./index";

afterEach(cleanup);

describe("Button", () => {
  it("disables interaction and exposes an accessible loading state", () => {
    render(
      <Button loading loadingLabel="Saving report">
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving report" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-loading", "true");
  });

  it("preserves an explicit disabled state", () => {
    render(<Button disabled>Unavailable</Button>);

    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("uses its mandatory label as the accessible name", () => {
    render(
      <IconButton aria-label="Open navigation">
        <svg aria-hidden="true" data-testid="menu-icon" />
      </IconButton>,
    );

    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeEnabled();
    expect(screen.getByTestId("menu-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("announces loading while blocking repeated activation", () => {
    render(
      <IconButton aria-label="Refresh prices" loading>
        R
      </IconButton>,
    );

    const button = screen.getByRole("button", {
      name: "Refresh prices, loading",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("semantic status primitives", () => {
  it("pairs every status tone with visible text and a decorative icon", () => {
    const { container } = render(
      <StatusPill tone="warning" label="Delayed data" />,
    );

    expect(screen.getByText("Delayed data")).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("Delayed data").parentElement).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("uses polite status semantics for empty and degraded states", () => {
    render(
      <>
        <EmptyState title="No stories yet" />
        <DegradedState title="Delayed market data" />
      </>,
    );

    expect(
      screen.getByRole("status", { name: "No stories yet" }),
    ).toHaveAttribute("data-state", "empty");
    expect(
      screen.getByRole("status", { name: "Delayed market data" }),
    ).toHaveAttribute("data-state", "degraded");
  });

  it("uses alert semantics for errors", () => {
    render(<ErrorState title="News could not be loaded" />);

    expect(
      screen.getByRole("alert", { name: "News could not be loaded" }),
    ).toHaveAttribute("data-state", "error");
  });

  it("keeps decorative skeletons hidden and labels standalone loading states", () => {
    const { rerender } = render(<Skeleton data-testid="skeleton" />);

    expect(screen.getByTestId("skeleton")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    rerender(<Skeleton label="Loading headlines" />);
    expect(
      screen.getByRole("status", { name: "Loading headlines" }),
    ).toBeInTheDocument();
  });
});
