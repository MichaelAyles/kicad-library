/**
 * Regression tests for parser bugs. Each block was written to fail first,
 * then the fix in src/lib/kicad-parser.ts made it pass.
 */
import { describe, expect, it } from "vitest";
import {
  extractSnippetFromFullFile,
  removeHierarchicalSheets,
  replacePaperSize,
  validateSExpression,
  wrapSnippetToFullFile,
} from "@/lib/kicad-parser";
import { fullFixture, snippetFixture } from "./fixtures";

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

/** Insert text just before the closing paren of the root kicad_sch list */
function insertBeforeRootClose(file: string, text: string): string {
  const close = file.lastIndexOf(")");
  return file.slice(0, close) + text + file.slice(close);
}

// In the file this is (text "C:\\" ...): a string whose last char is a backslash
const BACKSLASH_TEXT = `\t(text "Save to C:\\\\"
\t\t(exclude_from_sim no)
\t\t(at 20.32 20.32 0)
\t\t(effects
\t\t\t(font
\t\t\t\t(size 1.27 1.27)
\t\t\t)
\t\t)
\t\t(uuid "5b0f3c1e-8f0e-4d7a-9a51-0c6f2b8e7d01")
\t)
`;

describe("escaped backslash before a closing quote", () => {
  it("keeps an element whose string ends in a backslash", () => {
    const file = insertBeforeRootClose(
      fullFixture("kicad8-input-protection.kicad_sch"),
      BACKSLASH_TEXT,
    );
    const snippet = extractSnippetFromFullFile(file);
    expect(snippet).toContain('(text "Save to C:\\\\"');
    expect(snippet).toContain("5b0f3c1e-8f0e-4d7a-9a51-0c6f2b8e7d01");
    expect(snippet.endsWith("\t)")).toBe(true);
  });

  it("removes only the sheet when its name ends in a backslash", () => {
    const sheet = `\t(sheet
\t\t(at 50.8 50.8)
\t\t(size 25.4 12.7)
\t\t(uuid "0e4b6d43-0d3f-4b0c-9a43-1df0f5d8c001")
\t\t(property "Sheetname" "Power\\\\"
\t\t\t(at 50.8 50.0884 0)
\t\t)
\t\t(property "Sheetfile" "power.kicad_sch"
\t\t\t(at 50.8 64.0846 0)
\t\t)
\t)
`;
    const file = insertBeforeRootClose(
      fullFixture("kicad8-input-protection.kicad_sch"),
      sheet + BACKSLASH_TEXT,
    );
    const result = removeHierarchicalSheets(file);
    expect(result).not.toContain("power.kicad_sch");
    expect(result).toContain("5b0f3c1e-8f0e-4d7a-9a51-0c6f2b8e7d01");
    const v = validateSExpression(result);
    expect(v.valid).toBe(true);
    expect(v.metadata?.stats.componentCount).toBe(19);
  });
});

describe("extractSnippetFromFullFile with space indentation", () => {
  // KiCad 6 and 7 indent with two spaces, KiCad 8+ with tabs. The old regex
  // only looked for one tab, so every KiCad 6/7 circuit copied as "".
  it.each([
    ["kicad6-voltage-divider.kicad_sch", 41],
    ["kicad7-ntc-thermistor.kicad_sch", 41],
  ])("extracts all symbols from %s", (file, components) => {
    const snippet = extractSnippetFromFullFile(fullFixture(file));
    expect(snippet.startsWith("(lib_symbols")).toBe(true);
    const v = validateSExpression(snippet);
    expect(v.isSnippet).toBe(true);
    expect(v.metadata?.stats.componentCount).toBe(components);
  });

  it("extracts from a file made by wrapSnippetToFullFile", () => {
    // CircuitSnips-generated files put the snippet at column 0
    const snippet = snippetFixture("handmade-kicad6-spaces.clipboard.snippet");
    const extracted = extractSnippetFromFullFile(wrapSnippetToFullFile(snippet));
    expect(extracted).toBe(snippet.trim().replace(/\n(?=\()/g, "\n\n"));
  });

  it("keeps an empty (lib_symbols)", () => {
    const snippet = extractSnippetFromFullFile(
      fullFixture("kicad9-drawings.kicad_sch"),
    );
    expect(snippet.startsWith("(lib_symbols)")).toBe(true);
    expect(snippet).toContain("(circle");
  });
});
