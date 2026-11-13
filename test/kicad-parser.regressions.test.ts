/**
 * Regression tests for parser bugs. Each block was written to fail first,
 * then the fix in src/lib/kicad-parser.ts made it pass.
 */
import { describe, expect, it } from "vitest";
import {
  replacePaperSize,
  validateSExpression,
} from "@/lib/kicad-parser";
import { fullFixture } from "./fixtures";

describe("replacePaperSize handles every (paper) form", () => {
  it('rewrites (paper "A4" portrait)', () => {
    const file = '(kicad_sch (version 20231120)\n\t(paper "A4" portrait)\n)';
    expect(replacePaperSize(file, "A3")).toBe(
      '(kicad_sch (version 20231120)\n\t(paper "A3")\n)',
    );
  });

  it('rewrites (paper "User" w h) from a real KiCad 6 file', () => {
    const file = fullFixture("kicad6-paper-user.kicad_sch");
    expect(file).toContain('(paper "User" 400 300)');
    const result = replacePaperSize(file, "A2");
    expect(result).toContain('(paper "A2")');
    expect(result).not.toContain('"User"');
  });

  it('rewrites (paper "User" w h) in a CRLF KiCad 10 file', () => {
    const result = replacePaperSize(fullFixture("kicad10-symbols.kicad_sch"), "A4");
    expect(result).toContain('(paper "A4")');
    expect(result).not.toContain('"User"');
    expect(validateSExpression(result).metadata?.stats.componentCount).toBe(5);
  });

  it("only changes the paper node", () => {
    const file = fullFixture("kicad10-symbols.kicad_sch");
    const result = replacePaperSize(file, "A4");
    expect(result.replace('(paper "A4")', "")).toBe(
      file.replace('(paper "User" 399.999 299.999)', ""),
    );
  });
});
