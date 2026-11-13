import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));

export function fullFixture(name: string): string {
  return readFileSync(`${FIXTURE_DIR}full/${name}`, "utf8");
}

export function snippetFixture(name: string): string {
  return readFileSync(`${FIXTURE_DIR}snippets/${name}`, "utf8");
}

export interface FullFixture {
  file: string;
  kicad: number;
  version: string;
  indent: "tab" | "spaces";
  components: number;
  wires: number;
}

/**
 * Real schematics, one per KiCad major version. See fixtures/README.md
 * for where each came from. Counts were taken with grep, not the parser.
 */
export const FULL_FIXTURES: FullFixture[] = [
  {
    file: "kicad6-voltage-divider.kicad_sch",
    kicad: 6,
    version: "20211123",
    indent: "spaces",
    components: 41,
    wires: 99,
  },
  {
    file: "kicad7-ntc-thermistor.kicad_sch",
    kicad: 7,
    version: "20230121",
    indent: "spaces",
    components: 41,
    wires: 99,
  },
  {
    file: "kicad8-input-protection.kicad_sch",
    kicad: 8,
    version: "20231120",
    indent: "tab",
    components: 19,
    wires: 41,
  },
  {
    file: "kicad9-buck-regulator.kicad_sch",
    kicad: 9,
    version: "20250114",
    indent: "tab",
    components: 22,
    wires: 25,
  },
  {
    file: "kicad10-symbols.kicad_sch",
    kicad: 10,
    version: "20260306",
    indent: "tab",
    components: 5,
    wires: 0,
  },
];

/** Count top-level-looking nodes by name without using the parser. */
export function countNodes(text: string, name: string): number {
  return text.match(new RegExp(`\\(${name}[\\s)]`, "g"))?.length ?? 0;
}
