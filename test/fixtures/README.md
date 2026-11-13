# Parser test fixtures

Real KiCad schematics used by `test/kicad-parser.test.ts`. Files are kept
byte-for-byte (see `.gitattributes`); `kicad10-symbols.kicad_sch` has CRLF
line endings on purpose.

## full/

| File | KiCad | `(version)` | Source | License |
|------|-------|-------------|--------|---------|
| `kicad6-voltage-divider.kicad_sch` | 6 | 20211123 | circuitsnips.com `high-impedance-input-stage-voltage-divider-electrical`, from [GameWithPixels/Electrical](https://github.com/GameWithPixels/Electrical) | MIT |
| `kicad7-ntc-thermistor.kicad_sch` | 7 | 20230121 | circuitsnips.com `ntc-thermistor-voltage-divider-electrical-3`, from [GameWithPixels/Electrical](https://github.com/GameWithPixels/Electrical) | MIT |
| `kicad8-input-protection.kicad_sch` | 8 | 20231120 | circuitsnips.com `input-voltage-protection-filtering-stage-kicad-projects`, from [alexandrebobkov/KiCAD-Projects](https://github.com/alexandrebobkov/KiCAD-Projects) | MIT |
| `kicad9-buck-regulator.kicad_sch` | 9 | 20250114 | circuitsnips.com `5v-step-down-switching-regulator-buck-converter-frank`, from [rh1tech/frank](https://github.com/rh1tech/frank) | MIT |
| `kicad10-symbols.kicad_sch` | 10 | 20260306 | KiCanvas `test/kicad/files/symbols_kicad10.kicad_sch` | MIT (KiCanvas, (c) 2022 Alethea Katherine Flowers) |
| `kicad9-drawings.kicad_sch` | 9 | 20250114 | KiCanvas `test/kicad/files/drawings_kicad9.kicad_sch` | MIT (KiCanvas) |
| `kicad6-paper-user.kicad_sch` | 6 | 20211123 | KiCanvas `test/kicad/files/paper.kicad_sch` | MIT (KiCanvas) |
| `kicad5.99-20200618-trimmed.kicad_sch` | 5.99 nightly | 20200618 | Header and one symbol from circuitsnips.com `led-indicator-array-with-resistors-seminarkurs2021`, from [rraider/Seminarkurs2021](https://github.com/rraider/Seminarkurs2021) | MIT |
| `legacy-kicad5.sch` | 5 (legacy) | n/a | Hand-written | |

The circuitsnips.com files were downloaded from `/api/schematic/<slug>.kicad_sch`,
so they are the processed R2 copies (paper size rewritten, sheets stripped, and
the legacy top-level `(comment ...)` attribution the batch importer added).

## snippets/

| File | How it was made |
|------|-----------------|
| `kicad8-input-protection.extract.snippet` | `extractSnippetFromFullFile()` on the KiCad 8 fixture: first line at column 0, the rest keeps the file's one-tab indent |
| `kicad10-symbols.clipboard.snippet` | Same, on the KiCad 10 fixture, then dedented one tab so it looks like a KiCad clipboard copy (no header, CRLF kept) |
| `handmade-kicad6-spaces.clipboard.snippet` | Hand-written KiCad 6 style clipboard copy with two-space indentation: R1, R2, GND, two wires, one label |
