import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl, resolveWebSocketUrl } from "./runtime-config";

describe("runtime endpoint configuration", () => {
  it("supports same-origin production requests and a local development API", () => {
    expect(resolveApiBaseUrl(undefined, "production")).toEqual({
      value: "",
      issue: null,
    });
    expect(resolveApiBaseUrl(undefined, "development")).toEqual({
      value: "http://localhost:8000",
      issue: null,
    });
  });

  it("normalizes explicit HTTP and same-origin API bases", () => {
    expect(
      resolveApiBaseUrl("https://api.example.com/v1///", "production"),
    ).toEqual({
      value: "https://api.example.com/v1",
      issue: null,
    });
    expect(resolveApiBaseUrl("/backend/", "production")).toEqual({
      value: "/backend",
      issue: null,
    });
  });

  it("rejects credentialed or malformed endpoint URLs", () => {
    expect(
      resolveApiBaseUrl("https://user:secret@example.com", "production").value,
    ).toBeNull();
    expect(
      resolveApiBaseUrl("javascript:alert(1)", "production").issue,
    ).toContain("NEXT_PUBLIC_API_URL");
    expect(
      resolveWebSocketUrl("wss://user:secret@example.com/ws").value,
    ).toBeNull();
    expect(resolveWebSocketUrl("https://example.com/ws").issue).toContain(
      "NEXT_PUBLIC_WS_URL",
    );
  });
});
