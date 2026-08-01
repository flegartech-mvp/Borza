import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, getNewsPage, isTrueFeedUnavailable } from "./api";
import { DEFAULT_FILTERS } from "./filters";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validPage() {
  return {
    items: [],
    total: 0,
    limit: 12,
    offset: 0,
    has_more: false,
    window_hours: 24,
    effective_window_hours: 24,
    window_start: "2026-07-28T10:00:00Z",
    window_end: "2026-07-29T10:00:00Z",
    timestamp_field: "published_at",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API failure classification", () => {
  it("accepts a valid market-feed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(validPage())),
    );
    await expect(getNewsPage(DEFAULT_FILTERS)).resolves.toEqual(validPage());
  });

  it("normalizes unsafe runtime filters before building a request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validPage()));
    vi.stubGlobal("fetch", fetchMock);
    const unsafeFilters = {
      ...DEFAULT_FILTERS,
      search: "  rates  ",
      ticker: "AAPL!",
      minimum_impact: "101",
      window_hours: "999",
    };

    await expect(getNewsPage(unsafeFilters)).resolves.toEqual(validPage());

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get("search")).toBe("rates");
    expect(requestUrl.searchParams.get("ticker")).toBeNull();
    expect(requestUrl.searchParams.get("minimum_impact")).toBeNull();
    expect(requestUrl.searchParams.get("window_hours")).toBe("24");
  });

  it("classifies FastAPI 422 details as a validation problem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            detail: [
              {
                loc: ["query", "minimum_impact"],
                msg: "Input should be less than or equal to 100",
              },
            ],
          },
          422,
        ),
      ),
    );

    await expect(getNewsPage(DEFAULT_FILTERS)).rejects.toMatchObject({
      problem: {
        kind: "validation",
        status: 422,
        fieldErrors: [
          "query.minimum_impact: Input should be less than or equal to 100",
        ],
      },
    });
  });

  it("keeps client, unavailable, and contract failures distinct", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "Not found" }, 404))
      .mockResolvedValueOnce(
        jsonResponse({ detail: "Service warming up" }, 503),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getNewsPage(DEFAULT_FILTERS)).rejects.toMatchObject({
      problem: { kind: "client", status: 404 },
    });
    await expect(getNewsPage(DEFAULT_FILTERS)).rejects.toMatchObject({
      problem: { kind: "unavailable", status: 503 },
    });
    await expect(getNewsPage(DEFAULT_FILTERS)).rejects.toMatchObject({
      problem: { kind: "contract" },
    });
  });

  it("rejects scope responses that omit the effective bounded window", async () => {
    const invalidPage = validPage();
    delete (invalidPage as Partial<typeof invalidPage>).effective_window_hours;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(invalidPage)),
    );

    await expect(getNewsPage(DEFAULT_FILTERS)).rejects.toMatchObject({
      problem: { kind: "contract" },
    });
  });

  it("uses demo eligibility only for true connectivity or gateway failures", () => {
    const unavailable = new ApiRequestError({
      kind: "unavailable",
      endpoint: "market feed",
      message: "Unavailable",
    });
    const validation = new ApiRequestError({
      kind: "validation",
      endpoint: "market feed",
      message: "Invalid filters",
    });

    expect(isTrueFeedUnavailable(unavailable.problem)).toBe(true);
    expect(isTrueFeedUnavailable(validation.problem)).toBe(false);
  });

  it("classifies fetch failures as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(getNewsPage(DEFAULT_FILTERS)).rejects.toMatchObject({
      problem: {
        kind: "unavailable",
        detail: "Failed to fetch",
      },
    });
  });
});
