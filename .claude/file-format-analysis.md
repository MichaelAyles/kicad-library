# KiCad File Format Analysis

## S-Expression Format Overview

KiCad uses S-expressions (symbolic expressions) for all modern file formats (version 6+). This is a Lisp-like syntax that's both human-readable and machine-parseable.

### Format Characteristics

- **Extension**: `.kicad_sch` (schematics), `.kicad_sym` (symbols), `.kicad_pcb` (boards)
- **Syntax**: Parenthesis-delimited tokens `(token value ...)`
- **Encoding**: UTF-8 text
- **Design Goal**: Human-readable, version-control friendly
- **Strings**: Double-quoted, support Unicode
- **Numbers**: Can be integers or floats
- **Booleans**: `yes`/`no` keywords
- **All tokens are lowercase**

### Example S-Expression Structure

```scheme
(kicad_sch (version 20230121) (generator eeschema)
  (uuid "a1b2c3d4-...")

  (paper "A4")

  (lib_symbols
    (symbol "Device:R"
      (property "Reference" "R")
      (property "Value" "R")
      ...
    )
  )

  (symbol (lib_id "Device:R") (at 100 100 0)
    (uuid "e5f6g7h8-...")
    (property "Reference" "R1" (at 102 98 0))
    (property "Value" "10k" (at 102 102 0))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric")
  )

  (wire (pts (xy 95 100) (xy 105 100)))

  (label "VCC" (at 105 100 0))
)
```

## Clipboard Format (Copy/Paste)

**Critical Discovery**: When you copy schematic elements in KiCad, the **raw S-expression text** goes to the system clipboard!

### What Gets Copied

When you select and copy schematic elements:
- Symbols (components) with all properties
- Wires and buses
- Labels (net, global, hierarchical)
- Junctions
- Text and graphics
- **Embedded symbol definitions** (from lib_symbols)

### Example Clipboard Content

```scheme
(kicad_sch (version 20230121) (generator eeschema)

  (lib_symbols
    (symbol "Device:R"
      (property "Reference" "R")
      (property "Value" "R")
      (property "Footprint" "")
      (property "Datasheet" "~")
      (pin "1" (uuid "..."))
      (pin "2" (uuid "..."))
    )
  )

  (symbol (lib_id "Device:R") (at 127 95.25 0) (unit 1)
    (in_bom yes) (on_board yes) (dnp no)
    (uuid "12345678-1234-1234-1234-123456789abc")
    (property "Reference" "R1" (at 129.54 93.98 0)
      (effects (font (size 1.27 1.27)) (justify left))
    )
    (property "Value" "10k" (at 129.54 96.52 0)
      (effects (font (size 1.27 1.27)) (justify left))
    )
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 125.222 95.25 90)
      (effects (font (size 1.27 1.27)) hide)
    )
    (pin "1" (uuid "abcd-1234"))
    (pin "2" (uuid "efgh-5678"))
  )

  (wire (pts (xy 120 95.25) (xy 124.46 95.25))
    (stroke (width 0) (type default))
    (uuid "wire-uuid-1234")
  )
)
```

### Implications for Our Platform

1. **Direct Paste Support**: Users can copy from KiCad → paste into our web form → instant upload
2. **Validation**: We can validate structure before accepting
3. **Metadata Extraction**: Parse to extract component list, connections, etc.
4. **Portability**: Text format means easy sharing, no binary dependencies

## Schematic File Structure

### Top-Level Sections

#### 1. Header
```scheme
(kicad_sch (version 20230121) (generator eeschema)
  (uuid "unique-schematic-id")
  (paper "A4")  # or "A3", "Letter", etc.
)
```

#### 2. Library Symbols (lib_symbols)
**Key Point**: Since KiCad 6, **all symbols used in a schematic are embedded in the file**. This means:
- No external library dependencies
- Schematic is self-contained
- Perfect for sharing!

```scheme
(lib_symbols
  (symbol "Device:R"
    (pin_numbers hide)
    (pin_names (offset 0))
    (property "Reference" "R")
    (property "Value" "R")
    (property "Footprint" "")
    (property "Datasheet" "~")
    (symbol "Device:R_0_1"
      (rectangle (start -1.016 -2.54) (end 1.016 2.54))
    )
    (symbol "Device:R_1_1"
      (pin passive line (at 0 3.81 270) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
      (pin passive line (at 0 -3.81 90) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
    )
  )
)
```

#### 3. Symbol Instances
Actual component placements:

```scheme
(symbol (lib_id "Device:R") (at 127 95.25 0) (unit 1)
  (in_bom yes) (on_board yes) (dnp no) (fields_autoplaced)
  (uuid "component-uuid")
  (property "Reference" "R1" (at 129.54 93.98 0))
  (property "Value" "10k" (at 129.54 96.52 0))
  (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 125.222 95.25 90))
  (property "Datasheet" "~" (at 127 95.25 0))
  (pin "1" (uuid "pin1-uuid"))
  (pin "2" (uuid "pin2-uuid"))
)
```

**Key Fields**:
- `lib_id`: References symbol in lib_symbols
- `at X Y angle`: Position and rotation
- `unit`: For multi-unit symbols (e.g., quad op-amp)
- `in_bom`: Include in Bill of Materials?
- `on_board`: Include in PCB?
- `dnp`: "Do Not Populate" flag
- **`property "Footprint"`**: The PCB footprint assignment!

#### 4. Wires and Connections

```scheme
(wire (pts (xy 120 95.25) (xy 124.46 95.25))
  (stroke (width 0) (type default))
  (uuid "wire-uuid")
)

(junction (at 124.46 95.25) (diameter 0) (color 0 0 0 0)
  (uuid "junction-uuid")
)

(bus (pts (xy 50 50) (xy 60 50))
  (stroke (width 0) (type default))
  (uuid "bus-uuid")
)
```

#### 5. Labels

```scheme
# Net label (local to sheet)
(label "VCC" (at 127 90.17 0)
  (effects (font (size 1.27 1.27)) (justify left bottom))
  (uuid "label-uuid")
)

# Global label (across all sheets)
(global_label "SCL" (shape input) (at 100 100 180)
  (effects (font (size 1.27 1.27)) (justify right))
  (uuid "global-label-uuid")
  (property "Intersheetrefs" "${INTERSHEET_REFS}")
)

# Hierarchical label (for sheet interfaces)
(hierarchical_label "DATA[0..7]" (shape tri_state) (at 80 60 180)
  (effects (font (size 1.27 1.27)) (justify right))
  (uuid "hier-label-uuid")
)
```

#### 6. Hierarchical Sheets

```scheme
(sheet (at 50 50) (size 30 20)
  (stroke (width 0.1524) (type solid))
  (fill (color 0 0 0 0.0000))
  (uuid "sheet-uuid")
  (property "Sheetname" "Power Supply" (at 50 49.35 0))
  (property "Sheetfile" "power.kicad_sch" (at 50 70.65 0))
  (pin "VIN" input (at 50 55 180))
  (pin "VOUT" output (at 80 55 0))
)
```

**Important**: The sheet references another `.kicad_sch` file. For our platform:
- We should support **single-sheet subcircuits** initially
- Future: Support hierarchical subcircuits (multiple files)

#### 7. Graphics and Text

```scheme
(text "This is a voltage regulator" (at 100 120 0)
  (effects (font (size 1.27 1.27)) (justify left bottom))
  (uuid "text-uuid")
)

(rectangle (start 90 85) (end 140 115)
  (stroke (width 0) (type default))
  (fill (type none))
  (uuid "rect-uuid")
)
```

## Footprint Information in Schematics

### How Footprints Are Stored

**Key Finding**: Footprint assignments ARE included in schematic S-expressions!

Each symbol instance has a `Footprint` property:

```scheme
(property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 125.222 95.25 90)
  (effects (font (size 1.27 1.27)) hide)
)
```

**Format**: `LibraryName:FootprintName`

Examples:
- `Resistor_SMD:R_0805_2012Metric`
- `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm`
- `Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical`

### What's NOT Included

Schematic files do NOT contain:
- PCB layout information (trace routing, copper pours)
- Physical component placement on the board
- Layer stackup
- Design rules

These live in separate `.kicad_pcb` files.

### Implications for Our Platform

**What users get when they paste a subcircuit**:
- ✅ Schematic symbols and connections
- ✅ Component values (10k, 100nF, etc.)
- ✅ Footprint assignments (which physical package to use)
- ✅ Net names and labels
- ❌ PCB layout (they need to route it themselves)

**This is actually perfect** for a subcircuit library! Users want:
1. The circuit topology (schematic)
2. Component values
3. Recommended footprints
4. Then they integrate it into their own PCB layout

## Parsing Strategy

### Parser Requirements

1. **Tokenizer**: Split S-expression into tokens
2. **Tree Builder**: Build AST from tokens
3. **Validator**: Check for required fields, valid UUIDs, etc.
4. **Metadata Extractor**: Pull out components, nets, etc.

### Existing Libraries

**JavaScript/TypeScript**:
- `s-expression.js` - Simple parser
- `@tscircuit/kicadts` - TypeScript library for KiCad formats (found in research)
- `@flatten-js/core` - Has S-expr utilities
- Custom implementation is ~300 lines

**Python**:
- `sexpdata` - Mature S-expression parser
- `kicad-skip` - KiCad S-expression manipulation library
- `PyKicad` - KiCad file format library

**Recommendation**: Use `@tscircuit/kicadts` if available, or write custom parser (not complex).

### Metadata to Extract

From a pasted subcircuit, extract:

```typescript
interface SubcircuitMetadata {
  components: Array<{
    reference: string;        // "R1", "C2", "U1"
    value: string;            // "10k", "100nF", "LM358"
    footprint: string;        // "Resistor_SMD:R_0805_2012Metric"
    lib_id: string;          // "Device:R"
    uuid: string;
  }>;

  nets: Array<{
    name: string;             // "VCC", "GND", "SIGNAL"
    labels: string[];         // Where it's labeled
  }>;

  hierarchicalLabels: Array<{
    name: string;
    direction: "input" | "output" | "bidirectional" | "tri_state";
  }>;

  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };

  statistics: {
    componentCount: number;
    wireCount: number;
    netCount: number;
  };
}
```

### Validation Rules

Before accepting a subcircuit:

1. **Format Check**: Must be valid S-expression
2. **Version Check**: Must be KiCad 6+ format (version >= 20211014)
3. **Symbol Check**: All symbols must have embedded definitions (lib_symbols)
4. **UUID Check**: All UUIDs should be unique (regenerate on paste into KiCad anyway)
5. **Size Check**: Reasonable limits (e.g., < 1000 components, < 1MB file size)
6. **No Hierarchical Sheets** (for MVP): Keep it to single-sheet subcircuits

### UUID Regeneration

**Important**: When users paste into KiCad, UUIDs will conflict with existing components. KiCad handles this by:
- Regenerating UUIDs on paste
- Keeping relative positions
- Preserving all properties

Our platform doesn't need to worry about UUID conflicts since users will paste into their own projects.

## Version Compatibility

### KiCad Versions

- **KiCad 5 and earlier**: Used legacy `.sch` format (NOT S-expressions)
- **KiCad 6** (2021): Switched to `.kicad_sch` S-expression format
- **KiCad 7** (2023): Same format, added features (custom fonts, etc.)
- **KiCad 8** (2024): Same format, incremental improvements
- **KiCad 9** (in development): Will add "design blocks" feature

### Version Detection

```scheme
(kicad_sch (version 20230121) (generator eeschema)
```

The version is a date code: `YYYYMMDD`

**Our Platform Support**:
- Accept: KiCad 6+ (version >= 20211014)
- Display warning for KiCad 5 format
- Display info about version used

## Rendering from S-Expression

### KiCanvas Integration

KiCanvas can parse `.kicad_sch` files directly:

```typescript
import { KicadSch } from 'kicanvas';

const schematic = new KicadSch(sExpressionText);
schematic.render(canvasElement);
```

### Alternative: SVG Generation

For static previews:
1. Use KiCad CLI (if server has KiCad installed):
   ```bash
   kicad-cli sch export svg -o output.svg input.kicad_sch
   ```
2. Parse S-expression and render manually (complex)
3. Use KiCanvas headless (if it supports it)

**Recommendation**: Use KiCanvas on client-side for interactive viewing, generate SVG thumbnails for search results.

## Storage Strategy

### Database Schema

```sql
CREATE TABLE subcircuits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Raw data
    sexpr_raw TEXT NOT NULL,                    -- Original S-expression

    -- Parsed data
    sexpr_parsed JSONB NOT NULL,               -- Full parsed tree

    -- Extracted metadata (for fast queries)
    metadata JSONB NOT NULL,                   -- Components, nets, stats

    -- Search
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    search_vector TSVECTOR,                    -- Full-text search

    -- Rendering
    preview_svg TEXT,                           -- Or URL to S3
    thumbnail_url TEXT,

    -- Attribution
    user_id UUID NOT NULL REFERENCES users(id),
    license TEXT NOT NULL,

    -- Stats
    copy_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subcircuits_user ON subcircuits(user_id);
CREATE INDEX idx_subcircuits_tags ON subcircuits USING GIN(tags);
CREATE INDEX idx_subcircuits_search ON subcircuits USING GIN(search_vector);
CREATE INDEX idx_subcircuits_metadata ON subcircuits USING GIN(metadata);

-- Full-text search trigger
CREATE TRIGGER subcircuits_search_update
BEFORE INSERT OR UPDATE ON subcircuits
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.english', title, description);
```

### Query Examples

```sql
-- Search by text
SELECT * FROM subcircuits
WHERE search_vector @@ plainto_tsquery('english', 'voltage regulator');

-- Find subcircuits with specific component
SELECT * FROM subcircuits
WHERE metadata @> '{"components": [{"lib_id": "Regulator_Linear:LM7805"}]}';

-- Find subcircuits by tag
SELECT * FROM subcircuits
WHERE tags && ARRAY['power-supply', 'buck-converter'];

-- Most popular
SELECT * FROM subcircuits
ORDER BY copy_count DESC
LIMIT 10;
```

## Summary

### Key Takeaways

1. **Format**: S-expressions are text-based, human-readable, perfect for copy/paste
2. **Clipboard**: Raw S-expression text goes to clipboard when copying from KiCad
3. **Self-Contained**: KiCad 6+ embeds all symbols, making subcircuits portable
4. **Footprints Included**: Footprint assignments are in the schematic
5. **Layout NOT Included**: PCB routing is separate (which is fine!)
6. **Parsing**: Straightforward with existing libraries
7. **Rendering**: KiCanvas provides ready-made viewer
8. **Storage**: PostgreSQL JSONB is perfect for this data

### MVP Scope

For initial version:
- ✅ Accept single-sheet subcircuits (no hierarchical sheets)
- ✅ Parse and validate S-expressions
- ✅ Extract metadata (components, nets)
- ✅ Store raw + parsed + metadata
- ✅ Generate preview with KiCanvas
- ✅ Provide copy-to-clipboard functionality
- ❌ No hierarchical/multi-sheet support (add later)
- ❌ No PCB layout (not relevant for schematics)
