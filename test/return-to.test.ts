import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeReturnUrl } from "@/lib/auth/return-to";

describe("safeReturnUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { origin: "https://www.circuitsnips.com" },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("allows same-origin paths and URLs", () => {
    expect(safeReturnUrl("/upload")).toBe("https://www.circuitsnips.com/upload");
    expect(safeReturnUrl("/circuit/x?tab=1#c")).toBe(
      "https://www.circuitsnips.com/circuit/x?tab=1#c",
    );
    expect(safeReturnUrl("https://www.circuitsnips.com/settings")).toBe(
      "https://www.circuitsnips.com/settings",
    );
  });

  it("rejects other origins and schemes", () => {
    for (const value of [
      "//evil.example/path",
      "/\\evil.example",
      "https://evil.example/",
      "https://circuitsnips.com/", // apex is a different origin
      "http://www.circuitsnips.com/",
      "javascript:alert(1)",
      "data:text/html,hi",
    ]) {
      expect(safeReturnUrl(value), value).toBeNull();
    }
  });

  it("rejects non-strings", () => {
    expect(safeReturnUrl(undefined)).toBeNull();
    expect(safeReturnUrl({ returnTo: "/" })).toBeNull();
    expect(safeReturnUrl(42)).toBeNull();
  });
});
