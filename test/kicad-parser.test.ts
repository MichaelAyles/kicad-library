import { describe, expect, it } from "vitest";
import {
  addAttribution,
  escapeSExprString,
  extractSnippetFromFullFile,
  isClipboardSnippet,
  parseSExpression,
  removeHierarchicalSheets,
  replacePaperSize,
  selectSheetSize,
  SHEET_SIZES,
  validateSExpression,
  wrapSnippetToFullFile,
} from "@/lib/kicad-parser";
import {
  countNodes,
  FULL_FIXTURES,
  fullFixture,
  snippetFixture,
} from "./fixtures";

const SNIPPETS = [
  {
    file: "handmade-kicad6-spaces.clipboard.snippet",
    components: 3,
    wires: 2,
  },
  {
    file: "kicad8-input-protection.extract.snippet",
    components: 19,
    wires: 41,
  },
  {
    file: "kicad10-symbols.clipboard.snippet",
    components: 5,
    wires: 0,
  },
];

/** A KiCad 8 style hierarchical sheet block, indented as a kicad_sch child */
const SHEET_BLOCK = `	(sheet
		(at 50.8 50.8)
		(size 25.4 12.7)
		(fields_autoplaced yes)
		(stroke
			(width 0.1524)
			(type solid)
		)
		(fill
			(color 0 0 0 0.0000)
		)
		(uuid "0e4b6d43-0d3f-4b0c-9a43-1df0f5d8c001")
		(property "Sheetname" "Power"
			(at 50.8 50.0884 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify left bottom)
			)
		)
		(property "Sheetfile" "power.kicad_sch"
			(at 50.8 64.0846 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify left top)
			)
		)
		(pin "VIN" input
			(at 50.8 55.88 180)
			(uuid "0e4b6d43-0d3f-4b0c-9a43-1df0f5d8c002")
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify left)
			)
		)
		(instances
			(project "demo"
				(path "/0e4b6d43-0d3f-4b0c-9a43-1df0f5d8c000"
					(page "2")
				)
			)
		)
	)
	(sheet_instances
		(path "/"
			(page "1")
		)
	)
`;

/** Insert text just before the closing paren of the root kicad_sch list */
function insertBeforeRootClose(file: string, text: string): string {
  const close = file.lastIndexOf(")");
  return file.slice(0, close) + text + file.slice(close);
}

/** Text of the root's (title_block ...) child, found via the parser */
function titleBlockComments(file: string): Map<number, string> {
  const tree = parseSExpression(file);
  const tb = tree.children?.find(
    (c) => c.type === "list" && c.children?.[0]?.value === "title_block",
  );
  const out = new Map<number, string>();
  for (const c of tb?.children ?? []) {
    if (c.type === "list" && c.children?.[0]?.value === "comment") {
      out.set(Number(c.children[1].value), c.children[2].value ?? "");
    }
  }
  return out;
}

function topLevelNames(file: string): string[] {
  const tree = parseSExpression(file);
  return (tree.children ?? [])
    .filter((c) => c.type === "list")
    .map((c) => c.children?.[0]?.value ?? "");
}

// ============================================================================

describe("fixtures", () => {
  it.each(FULL_FIXTURES)("$file declares (version $version)", (f) => {
    expect(fullFixture(f.file)).toMatch(
      new RegExp(`^\\(kicad_sch\\s+\\(version ${f.version}\\)`),
    );
  });

  it("covers KiCad 6 through 10", () => {
    expect(FULL_FIXTURES.map((f) => f.kicad)).toEqual([6, 7, 8, 9, 10]);
  });

  it("includes a CRLF file (KiCad 10) to cover Windows line endings", () => {
    expect(fullFixture("kicad10-symbols.kicad_sch")).toContain("\r\n");
  });
});

describe("isClipboardSnippet", () => {
  it.each(FULL_FIXTURES)("is false for full file $file", (f) => {
    expect(isClipboardSnippet(fullFixture(f.file))).toBe(false);
  });

  it.each(SNIPPETS)("is true for snippet $file", (s) => {
    expect(isClipboardSnippet(snippetFixture(s.file))).toBe(true);
  });

  it("is true for a symbol without lib_symbols", () => {
    expect(isClipboardSnippet('(symbol (lib_id "Device:R") (at 0 0 0))')).toBe(
      true,
    );
  });

  it("ignores leading whitespace on full files", () => {
    expect(
      isClipboardSnippet("\n\n  " + fullFixture("kicad9-drawings.kicad_sch")),
    ).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["plain text", "hello world"],
    ["legacy KiCad 5", fullFixture("legacy-kicad5.sch")],
  ])("is false for %s", (_label, input) => {
    expect(isClipboardSnippet(input)).toBe(false);
  });
});

describe("wrapSnippetToFullFile", () => {
  const snippet = snippetFixture("handmade-kicad6-spaces.clipboard.snippet");

  it("wraps the snippet verbatim in a kicad_sch header", () => {
    const wrapped = wrapSnippetToFullFile(snippet, {
      title: "Divider",
      uuid: "11111111-2222-3333-4444-555555555555",
      paperSize: "A3",
    });
    expect(wrapped.startsWith("(kicad_sch")).toBe(true);
    expect(wrapped).toContain("(version 20231120)");
    expect(wrapped).toContain('(uuid "11111111-2222-3333-4444-555555555555")');
    expect(wrapped).toContain('(paper "A3")');
    expect(wrapped).toContain('(title "Divider")');
    expect(wrapped).toContain(snippet);
    expect(isClipboardSnippet(wrapped)).toBe(false);
  });

  it("defaults to A4 and a generated uuid", () => {
    const wrapped = wrapSnippetToFullFile(snippet);
    expect(wrapped).toContain('(paper "A4")');
    expect(wrapped).toMatch(/\(uuid "[0-9a-f-]{36}"\)/);
  });

  it("escapes quotes and backslashes in the title", () => {
    const wrapped = wrapSnippetToFullFile(snippet, {
      title: 'Say "hi" C:\\',
    });
    expect(wrapped).toContain('(title "Say \\"hi\\" C:\\\\")');
    const tree = parseSExpression(wrapped);
    const tb = tree.children?.find(
      (c) => c.children?.[0]?.value === "title_block",
    );
    expect(tb?.children?.[1]?.children?.[1]?.value).toBe('Say "hi" C:\\');
  });

  it("produces a file the validator accepts as a full file", () => {
    const result = validateSExpression(wrapSnippetToFullFile(snippet));
    expect(result.valid).toBe(true);
    expect(result.isSnippet).toBe(false);
    expect(result.metadata?.stats.componentCount).toBe(3);
  });
});

describe("extractSnippetFromFullFile", () => {
  it("matches the committed KiCad 8 extract", () => {
    const extracted = extractSnippetFromFullFile(
      fullFixture("kicad8-input-protection.kicad_sch"),
    );
    expect(extracted + "\n").toBe(
      snippetFixture("kicad8-input-protection.extract.snippet"),
    );
  });

  it.each(FULL_FIXTURES)(
    "strips file-level nodes from $file and keeps every symbol and wire",
    (f) => {
      const full = fullFixture(f.file);
      const snippet = extractSnippetFromFullFile(full);
      expect(snippet.startsWith("(lib_symbols")).toBe(true);
      for (const banned of [
        "(kicad_sch",
        "(generator ",
        "(paper ",
        "(title_block",
        "(sheet_instances",
      ]) {
        expect(snippet).not.toContain(banned);
      }
      expect(countNodes(snippet, "lib_id")).toBe(f.components);
      expect(countNodes(snippet, "wire")).toBe(f.wires);
      expect(isClipboardSnippet(snippet)).toBe(true);
    },
  );

  it("does not pick up nested symbols as top-level elements", () => {
    const snippet = extractSnippetFromFullFile(
      fullFixture("kicad10-symbols.kicad_sch"),
    );
    // 1 lib_symbols block + 5 placed symbols
    expect(snippet.split(/\r?\n\r?\n/)).toHaveLength(6);
  });

  it("drops legacy top-level (comment) nodes", () => {
    const snippet = extractSnippetFromFullFile(
      fullFixture("kicad9-buck-regulator.kicad_sch"),
    );
    expect(snippet).not.toContain("CircuitSnips.com");
  });
});

describe("validateSExpression", () => {
  it.each(FULL_FIXTURES)(
    "accepts KiCad $kicad file $file with $components components",
    (f) => {
      const result = validateSExpression(fullFixture(f.file));
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.isSnippet).toBe(false);
      expect(result.originalFormat).toBe("full");
      expect(result.metadata?.version).toBe(f.version);
      expect(result.metadata?.stats.componentCount).toBe(f.components);
      expect(result.metadata?.stats.wireCount).toBe(f.wires);
    },
  );

  it.each(SNIPPETS)("accepts snippet $file", (s) => {
    const result = validateSExpression(snippetFixture(s.file));
    expect(result.valid).toBe(true);
    expect(result.isSnippet).toBe(true);
    expect(result.originalFormat).toBe("snippet");
    expect(result.warnings[0]).toMatch(/Clipboard snippet detected/);
    expect(result.metadata?.stats.componentCount).toBe(s.components);
    expect(result.metadata?.stats.wireCount).toBe(s.wires);
  });

  it("extracts component details, nets and footprint stats", () => {
    const result = validateSExpression(
      snippetFixture("handmade-kicad6-spaces.clipboard.snippet"),
    );
    const meta = result.metadata!;
    expect(meta.components.map((c) => c.reference)).toEqual([
      "R1",
      "R2",
      "#PWR01",
    ]);
    expect(meta.components[0]).toMatchObject({
      lib_id: "Device:R",
      value: "10k",
      footprint: "Resistor_SMD:R_0603_1608Metric",
      position: { x: 100.33, y: 59.69, angle: 0 },
    });
    expect(meta.uniqueComponents).toEqual([
      { lib_id: "Device:R", count: 2, values: ["10k", "22k"] },
      { lib_id: "power:GND", count: 1, values: ["GND"] },
    ]);
    expect(meta.nets).toEqual([{ name: "VOUT", type: "label" }]);
    // Power symbols don't need footprints; R2 has none
    expect(meta.footprints).toEqual({
      assigned: 1,
      unassigned: 1,
      types: ["Resistor_SMD:R_0603_1608Metric"],
    });
    expect(meta.boundingBox).toEqual({
      minX: 100.33,
      minY: 59.69,
      maxX: 120.65,
      maxY: 68.58,
    });
    expect(result.warnings).toContain(
      "1 component(s) missing footprint assignments",
    );
  });

  it("counts KiCad 8 symbols by library", () => {
    const meta = validateSExpression(
      fullFixture("kicad8-input-protection.kicad_sch"),
    ).metadata!;
    const byLib = Object.fromEntries(
      meta.uniqueComponents.map((u) => [u.lib_id, u.count]),
    );
    expect(byLib).toMatchObject({
      "Device:C_Polarized_Small": 7,
      "Connector:TestPoint": 4,
      "power:GND": 2,
      "Device:D": 1,
    });
  });

  it("warns when a schematic has no components", () => {
    const result = validateSExpression(fullFixture("kicad6-paper-user.kicad_sch"));
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("No components found in schematic");
  });

  it("rejects a pre-KiCad 6 (5.99 nightly, version 20200618) file", () => {
    const result = validateSExpression(
      fullFixture("kicad5.99-20200618-trimmed.kicad_sch"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/KiCad 5 or earlier/);
  });

  it("rejects a kicad_sch with no version", () => {
    const result = validateSExpression('(kicad_sch (paper "A4"))');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/KiCad 5 or earlier/);
  });

  it("accepts the first KiCad 6 version (20211014)", () => {
    expect(validateSExpression("(kicad_sch (version 20211014))").valid).toBe(
      true,
    );
    expect(validateSExpression("(kicad_sch (version 20211013))").valid).toBe(
      false,
    );
  });

  it("rejects a legacy KiCad 5 .sch file", () => {
    const result = validateSExpression(fullFixture("legacy-kicad5.sch"));
    expect(result.valid).toBe(false);
  });

  it.each([
    ["empty input", "", /Empty input/],
    ["whitespace", "  \n\t ", /Empty input/],
    ["extra closing paren", "(kicad_sch (version 20231120)))", /extra closing/],
    ["missing closing paren", "(kicad_sch (version 20231120)", /missing closing/],
    ["plain text", "hello world", /Invalid S-expression/],
    ["another S-expression", '(kicad_pcb (version 20231120))', /expected kicad_sch/],
    ["unclosed string", '(kicad_sch (version 20231120) (paper "A4))', /Unclosed/],
  ])("rejects %s", (_label, input, error) => {
    const result = validateSExpression(input);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(error);
  });
});

describe("selectSheetSize", () => {
  const box = (w: number, h: number, x = 10, y = 10) => ({
    minX: x,
    minY: y,
    maxX: x + w,
    maxY: y + h,
  });

  it.each([
    ["empty", 0, 0, "A4", false],
    ["exactly A4", SHEET_SIZES.A4.width, SHEET_SIZES.A4.height, "A4", false],
    ["just wider than A4", SHEET_SIZES.A4.width + 0.01, 10, "A3", false],
    ["just taller than A4", 10, SHEET_SIZES.A4.height + 0.01, "A3", false],
    ["exactly A3", SHEET_SIZES.A3.width, SHEET_SIZES.A3.height, "A3", false],
    ["just over A3", SHEET_SIZES.A3.width + 1, 10, "A2", false],
    ["exactly A2", SHEET_SIZES.A2.width, SHEET_SIZES.A2.height, "A2", false],
    ["bigger than A2", SHEET_SIZES.A2.width + 1, 10, "A2", true],
  ] as const)("%s -> %s", (_label, w, h, size, oversized) => {
    const result = selectSheetSize(box(w, h));
    expect(result.size).toBe(size);
    expect(result.recommended).toBe(size);
    expect(result.isOversized).toBe(oversized);
    expect(result.boundingBox.width).toBeCloseTo(w);
    expect(result.boundingBox.height).toBeCloseTo(h);
  });

  it.each(FULL_FIXTURES)("picks A4 for $file", (f) => {
    const meta = validateSExpression(fullFixture(f.file)).metadata!;
    expect(selectSheetSize(meta.boundingBox).size).toBe("A4");
  });

  // Known limitation, left as-is: only the extent is compared, not where the
  // content sits. Parts spanning x=300..350mm get "A4" (297mm wide), so a
  // full file shrunk to A4 by replacePaperSize has them off the page.
  // Fixing it changes the size chosen for many existing circuits.
  it.todo("accounts for content offset, not just its extent");
});

describe("removeHierarchicalSheets", () => {
  const base = fullFixture("kicad8-input-protection.kicad_sch");
  const withSheet = insertBeforeRootClose(base, SHEET_BLOCK);

  it("removes (sheet) and (sheet_instances) blocks", () => {
    expect(topLevelNames(withSheet)).toContain("sheet");
    const result = removeHierarchicalSheets(withSheet);
    expect(topLevelNames(result)).not.toContain("sheet");
    expect(topLevelNames(result)).not.toContain("sheet_instances");
    expect(result).not.toContain("power.kicad_sch");
  });

  it("leaves the rest of the schematic intact", () => {
    const result = validateSExpression(removeHierarchicalSheets(withSheet));
    expect(result.valid).toBe(true);
    expect(result.metadata?.stats.componentCount).toBe(19);
    expect(result.metadata?.stats.wireCount).toBe(41);
  });

  it("removes the root sheet_instances from a KiCad 10 file", () => {
    const file = fullFixture("kicad10-symbols.kicad_sch");
    const result = removeHierarchicalSheets(file);
    expect(topLevelNames(result)).not.toContain("sheet_instances");
    expect(validateSExpression(result).metadata?.stats.componentCount).toBe(5);
  });

  it("is a no-op when there are no sheets", () => {
    const file = fullFixture("kicad7-ntc-thermistor.kicad_sch");
    expect(removeHierarchicalSheets(file)).toBe(file);
  });

  it("does not touch symbol_instances in KiCad 6 files", () => {
    const file = fullFixture("kicad6-voltage-divider.kicad_sch");
    expect(removeHierarchicalSheets(file)).toBe(file);
  });
});

describe("addAttribution", () => {
  const opts = {
    author: "alice",
    url: "https://circuitsnips.com/circuit/test",
    license: "MIT",
  };

  it("fills free title_block slots and keeps the author's comments", () => {
    // KiCad 10 fixture uses comments 1, 3, 5, 7, 9
    const result = addAttribution(fullFixture("kicad10-symbols.kicad_sch"), opts);
    const comments = titleBlockComments(result);
    expect(comments.get(1)).toBe("comment 1");
    expect(comments.get(2)).toBe(`Source: ${opts.url}`);
    expect(comments.get(4)).toMatch(
      /^Author: alice \| License: MIT \| Downloaded: \d{4}-\d{2}-\d{2}$/,
    );
    expect(comments.get(9)).toBe("comment 9");
    expect(validateSExpression(result).valid).toBe(true);
  });

  it("moves legacy top-level comments into the title_block", () => {
    const file = fullFixture("kicad6-voltage-divider.kicad_sch");
    expect(topLevelNames(file)).toContain("comment");

    const result = addAttribution(file, opts);
    expect(topLevelNames(result)).not.toContain("comment");
    const comments = titleBlockComments(result);
    expect(comments.get(1)).toBe("Wireless Charging Circuitry");
    expect(comments.get(2)).toBe(`Source: ${opts.url}`);
    expect(comments.get(4)).toBe(
      "GitHub: https://github.com/GameWithPixels/Electrical",
    );
    expect(comments.get(7)).toBe("Imported: 2025-10-29 | CircuitSnips.com");
    expect(validateSExpression(result).metadata?.stats.componentCount).toBe(41);
  });

  it("creates a title_block when the file has none", () => {
    const file = fullFixture("kicad9-drawings.kicad_sch");
    expect(topLevelNames(file)).not.toContain("title_block");
    const result = addAttribution(file, opts);
    const names = topLevelNames(result);
    expect(names.indexOf("title_block")).toBe(names.indexOf("paper") + 1);
    expect(titleBlockComments(result).get(1)).toBe(`Source: ${opts.url}`);
  });

  it("works on a wrapped snippet", () => {
    const wrapped = wrapSnippetToFullFile(
      snippetFixture("handmade-kicad6-spaces.clipboard.snippet"),
    );
    const comments = titleBlockComments(addAttribution(wrapped, opts));
    expect([...comments.keys()]).toEqual([1, 2]);
  });

  it("escapes quotes in author names", () => {
    const result = addAttribution(fullFixture("kicad9-drawings.kicad_sch"), {
      ...opts,
      author: 'Bob "the builder"',
    });
    expect(result).toContain(escapeSExprString('Bob "the builder"'));
    expect(titleBlockComments(result).get(2)).toMatch(
      /^Author: Bob "the builder" \|/,
    );
  });

  it("leaves snippets unchanged", () => {
    const snippet = snippetFixture("handmade-kicad6-spaces.clipboard.snippet");
    expect(addAttribution(snippet, opts)).toBe(snippet);
  });
});

describe("replacePaperSize", () => {
  it('rewrites (paper "A4")', () => {
    const result = replacePaperSize(
      fullFixture("kicad8-input-protection.kicad_sch"),
      "A3",
    );
    expect(result).toContain('(paper "A3")');
    expect(result).not.toContain('(paper "A4")');
  });

  it("is a no-op when the size already matches", () => {
    const file = fullFixture("kicad9-buck-regulator.kicad_sch");
    expect(replacePaperSize(file, "A4")).toBe(file);
  });
});

describe("round trip: extract -> wrap -> validate", () => {
  it.each(FULL_FIXTURES)("keeps all $components components of $file", (f) => {
    const snippet = extractSnippetFromFullFile(fullFixture(f.file));
    const result = validateSExpression(wrapSnippetToFullFile(snippet));
    expect(result.valid).toBe(true);
    expect(result.metadata?.stats.componentCount).toBe(f.components);
    expect(result.metadata?.stats.wireCount).toBe(f.wires);
  });

  it.each(SNIPPETS)("validating $file as-is and wrapped agree", (s) => {
    const raw = snippetFixture(s.file);
    const direct = validateSExpression(raw);
    const wrapped = validateSExpression(wrapSnippetToFullFile(raw));
    expect(wrapped.metadata?.stats).toEqual(direct.metadata?.stats);
  });
});
