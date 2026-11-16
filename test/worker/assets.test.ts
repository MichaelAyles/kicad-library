import { describe, expect, it } from "vitest";
import { shellPathFor } from "../../worker/assets";

describe("shellPathFor", () => {
  it("maps circuit pages and their RSC payloads to the shell", () => {
    expect(shellPathFor("/circuit/foo")).toBe("/circuit/_");
    expect(shellPathFor("/circuit/foo/")).toBe("/circuit/_");
    expect(shellPathFor("/circuit/foo.txt")).toBe("/circuit/_.txt");
    expect(shellPathFor("/circuit/foo/edit")).toBe("/circuit/_/edit");
    expect(shellPathFor("/circuit/foo/edit.txt")).toBe("/circuit/_/edit.txt");
    expect(shellPathFor("/circuit/_/edit")).toBe("/circuit/_/edit");
  });

  it("ignores everything else, including the shell itself", () => {
    expect(shellPathFor("/circuit/_")).toBeNull();
    expect(shellPathFor("/circuit")).toBeNull();
    expect(shellPathFor("/circuit/a/b")).toBeNull();
    expect(shellPathFor("/browse")).toBeNull();
  });
});
