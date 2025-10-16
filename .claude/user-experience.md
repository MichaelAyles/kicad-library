# User Experience & Workflows

## User Personas

### 1. Electronics Hobbyist (Emily)
- **Background**: Makes Arduino projects, DIY electronics
- **Needs**: Quick reference circuits (LED driver, voltage regulator, sensor interface)
- **Pain Points**: Redrawing common circuits from scratch
- **Goals**: Copy/paste working subcircuits to speed up projects

### 2. Professional Engineer (Pradeep)
- **Background**: Designs commercial products, works in teams
- **Needs**: Verified, well-documented circuit blocks with proper footprints
- **Pain Points**: Building internal component libraries, ensuring consistency
- **Goals**: Share circuits within team, contribute to community for reputation

### 3. Student (Sarah)
- **Background**: Learning electronics design, taking university courses
- **Needs**: Educational examples, understanding how circuits work
- **Pain Points**: Textbook circuits aren't in KiCad format
- **Goals**: Learn by studying real designs, build portfolio

### 4. Open Source Hardware Designer (Oliver)
- **Background**: Creates open source projects, values attribution
- **Needs**: License clarity, proper attribution mechanisms
- **Pain Points**: Tracking who uses their designs, ensuring share-alike compliance
- **Goals**: Share designs, get credit, ensure derivatives remain open

## Core User Journeys

### Journey 1: Discovering a Subcircuit

```
Sarah searches "lm358 opamp" → Results show:
  [Preview] LM358 Dual Op-Amp Circuit
  by @johndoe | MIT License | 47 copies | ⭐ 12 favorites

Click → Detail page shows:
  - Interactive schematic viewer (KiCanvas)
  - Component list (R1: 10k, C1: 100nF, U1: LM358)
  - Description: "Non-inverting amplifier with gain of 10"
  - Tags: opamp, amplifier, analog
  - Copy button
  - Favorite button
  - Attribution text

Click "Copy" → S-expression copied to clipboard with attribution comments

Open KiCad → Paste → Circuit appears in schematic!
```

**UX Priorities**:
1. **Fast Discovery**: Search must be quick, results relevant
2. **Visual Preview**: Thumbnail + interactive viewer
3. **Trust Signals**: Copy count, favorites, author reputation
4. **One-Click Copy**: No friction in getting the S-expression
5. **Auto-Attribution**: Embed credits in copied data

### Journey 2: Uploading a Subcircuit

```
Pradeep creates a voltage regulator circuit in KiCad →
Selects components + wires → Copy (Ctrl+C) →
Opens platform → Click "Upload" →

Paste S-expression into text area →
Platform parses and shows preview →
Pradeep fills in:
  - Title: "LM7805 5V Regulator"
  - Description: "Standard linear regulator with input/output caps"
  - Tags: power, regulator, linear
  - License: CERN-OHL-S-2.0
  - ☑ I own this design / have permission

Click "Publish" → Redirects to detail page →
Share URL with team!
```

**UX Priorities**:
1. **Paste Recognition**: Auto-detect S-expression format
2. **Instant Preview**: Show parsed circuit immediately
3. **Smart Defaults**: Suggest title from components, tags from description
4. **License Guidance**: Explain options clearly
5. **Validation Feedback**: Show errors early (missing footprints, etc.)

### Journey 3: Building a Collection

```
Emily browses "arduino" tag → Finds useful circuits:
  - ATmega328 crystal oscillator
  - USB-to-UART interface
  - 3.3V power supply

Clicks ⭐ Favorite on each →
Goes to "My Favorites" page →
Creates Collection: "Arduino Building Blocks" →
Adds favorited circuits to collection →
Collection shows compatibility warnings (license conflicts)
```

**UX Priorities** (Phase 2):
1. **Quick Favoriting**: One-click star
2. **Collections**: Organize favorites into groups
3. **License Checker**: Warn about incompatible licenses
4. **Export Collection**: Download all as ZIP

## UI/UX Design

### Homepage

```
┌─────────────────────────────────────────────────────┐
│  [Logo] KiCad Circuit Library        [Search...] 🔍 │
│                                    [Sign In GitHub]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│         Share and Discover                          │
│         KiCad Schematic Subcircuits                 │
│                                                      │
│         [Upload Subcircuit]  [Browse Library]       │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Featured Circuits                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │[Preview] │  │[Preview] │  │[Preview] │          │
│  │ LM358    │  │ Buck     │  │ USB-C    │          │
│  │ Op-Amp   │  │ Converter│  │ Power    │          │
│  │ ⭐ 24    │  │ ⭐ 18    │  │ ⭐ 31    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  Popular Tags                                        │
│  [power-supply] [amplifier] [microcontroller]       │
│  [sensor] [usb] [arduino]                           │
│                                                      │
│  Recently Added | Most Copied | Trending            │
└─────────────────────────────────────────────────────┘
```

### Search Results Page

```
┌─────────────────────────────────────────────────────┐
│  Search: "voltage regulator"                   🔍   │
│  ┌──────────────────────────────────────────────┐   │
│  │ Filters                                      │   │
│  │ Category: [All ▼]                           │   │
│  │ License:  [All ▼]                           │   │
│  │ Components: 0 ──────●────── 50+             │   │
│  │ ☑ Only with footprints                      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  52 results | Sort: [Relevance ▼]                   │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ [Thumbnail]  LM7805 5V Linear Regulator       │ │
│  │              by @pradeep | CERN-OHL-S         │ │
│  │              Classic 7805 with input/output   │ │
│  │              capacitors. Handles up to 1.5A.  │ │
│  │              📦 5 components | 🔗 47 copies   │ │
│  │              [power] [regulator] [linear]     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ [Thumbnail]  LM2596 Buck Converter            │ │
│  │              by @emily | MIT License          │ │
│  │              Step-down switching regulator,   │ │
│  │              3A output, adjustable voltage.   │ │
│  │              📦 12 components | 🔗 31 copies  │ │
│  │              [power] [buck] [switching]       │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Load More Results...]                             │
└─────────────────────────────────────────────────────┘
```

### Subcircuit Detail Page

```
┌─────────────────────────────────────────────────────┐
│  ← Back to Search                                    │
│                                                      │
│  LM358 Dual Op-Amp Non-Inverting Amplifier          │
│  by @johndoe | Uploaded Jan 15, 2024                │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │                                                │ │
│  │      [Interactive KiCanvas Viewer]             │ │
│  │      (Zoomable, pan-able schematic)            │ │
│  │                                                │ │
│  │      [ + ]  [ - ]  [Fit]  [Fullscreen]        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [📋 Copy to Clipboard]  [⭐ Favorite (12)]         │
│                          [▼ Download SVG]           │
│                                                      │
│  Description                                         │
│  Non-inverting amplifier using LM358 dual op-amp.   │
│  Gain = 1 + R2/R1 = 10. Input impedance ~1MΩ.      │
│  Suitable for audio and sensor signal conditioning. │
│                                                      │
│  Components (4)                                      │
│  ┌────────┬────────┬────────────────────────────┐   │
│  │ Ref    │ Value  │ Footprint                  │   │
│  ├────────┼────────┼────────────────────────────┤   │
│  │ U1     │ LM358  │ Package_SO:SOIC-8_3.9x4.9mm│   │
│  │ R1     │ 1k     │ Resistor_SMD:R_0805_2012   │   │
│  │ R2     │ 10k    │ Resistor_SMD:R_0805_2012   │   │
│  │ C1     │ 100nF  │ Capacitor_SMD:C_0805_2012  │   │
│  └────────┴────────┴────────────────────────────┘   │
│                                                      │
│  Interface (Hierarchical Labels)                     │
│  • VIN (input) - Signal input                       │
│  • VOUT (output) - Amplified output                 │
│  • VCC (input) - Power supply +                     │
│  • GND (input) - Ground                             │
│                                                      │
│  License                                             │
│  [CERN-OHL-S-2.0 Badge]                             │
│  This design is open source hardware.              │
│  [View Full License Text]                           │
│                                                      │
│  Attribution                                         │
│  ┌────────────────────────────────────────────────┐ │
│  │ Copy this attribution:                         │ │
│  │ ───────────────────────────────────────────── │ │
│  │ "LM358 Dual Op-Amp Non-Inverting Amplifier"  │ │
│  │ by @johndoe                                    │ │
│  │ https://kicadlib.io/circuits/abc123           │ │
│  │ Licensed under CERN-OHL-S-2.0                 │ │
│  │ [📋 Copy]                                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Tags                                                │
│  [opamp] [amplifier] [analog] [audio]              │
│                                                      │
│  Stats                                               │
│  👁 234 views | 📋 47 copies | ⭐ 12 favorites       │
│                                                      │
│  More from @johndoe                                 │
│  [Preview] [Preview] [Preview]                      │
└─────────────────────────────────────────────────────┘
```

### Upload Page

```
┌─────────────────────────────────────────────────────┐
│  Upload Subcircuit                                   │
│                                                      │
│  Step 1: Paste Schematic Data                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ Paste KiCad schematic S-expression here...    │ │
│  │                                                │ │
│  │ (kicad_sch (version 20230121)                 │ │
│  │   (lib_symbols                                │ │
│  │     ...                                       │ │
│  │                                                │ │
│  │                                                │ │
│  └────────────────────────────────────────────────┘ │
│  💡 Tip: Select components in KiCad and Ctrl+C      │
│                                                      │
│  [Parse & Preview]                                  │
│                                                      │
│  ─── After Parsing ───                              │
│                                                      │
│  ✓ Valid KiCad 7.0 format detected                 │
│  ✓ 4 components found                              │
│  ✓ All footprints assigned                         │
│                                                      │
│  Preview                                             │
│  ┌────────────────────────────────────────────────┐ │
│  │ [Rendered schematic preview]                   │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Step 2: Add Details                                │
│  Title*                                             │
│  [LM358 Dual Op-Amp Circuit_______________]         │
│                                                      │
│  Description                                         │
│  [Non-inverting amplifier with gain of 10...]       │
│  [                                          ]        │
│                                                      │
│  Tags (press Enter after each)                      │
│  [opamp × ] [amplifier × ] [audio × ] [______]     │
│  Suggestions: analog, lm358                         │
│                                                      │
│  Category                                            │
│  [Amplifier ▼]                                      │
│                                                      │
│  License*  [?]                                      │
│  ● CERN-OHL-S-2.0 (Recommended for hardware)       │
│  ○ MIT License (Permissive)                        │
│  ○ CC-BY-SA-4.0 (Creative Commons Share-Alike)     │
│  ○ More options...                                  │
│                                                      │
│  ☑ I am the original creator OR have permission    │
│  ☑ This design does not infringe any IP rights     │
│                                                      │
│  [Cancel]           [Save as Draft] [Publish]       │
└─────────────────────────────────────────────────────┘
```

### User Profile Page

```
┌─────────────────────────────────────────────────────┐
│  [@johndoe]                        [Edit Profile]    │
│  [Avatar]  John Doe                                  │
│            Electronics hobbyist, open source         │
│            enthusiast                                │
│            🔗 johndoe.com | 📍 San Francisco        │
│                                                      │
│  Joined Jan 2024 | 47 total copies received         │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ [12 Subcircuits] [47 Favorites] [3 Collections]│ │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Subcircuits (12)                                    │
│  ┌────────────────────────────────────────────────┐ │
│  │ [Preview] LM358 Op-Amp Circuit                │ │
│  │           📋 47 copies | ⭐ 12 favorites       │ │
│  │           CERN-OHL-S | Jan 15, 2024           │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ [Preview] Buck Converter 12V→5V               │ │
│  │           📋 31 copies | ⭐ 8 favorites        │ │
│  │           MIT License | Jan 10, 2024          │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [View All Subcircuits...]                          │
└─────────────────────────────────────────────────────┘
```

## Key UX Patterns

### 1. Instant Preview
**Principle**: Show, don't tell

When user pastes S-expression:
- Parse in <500ms
- Show rendered preview immediately
- Display extracted metadata (components, nets)
- Highlight any issues (missing footprints, invalid format)

### 2. Progressive Disclosure
**Principle**: Don't overwhelm with options

- Basic upload: Just title, description, license
- Advanced: Click "Advanced Options" to set category, collection, visibility
- Keep common path simple

### 3. Trust Signals
**Principle**: Help users evaluate quality

Display prominently:
- Copy count (social proof)
- Favorite count (quality indicator)
- Author reputation (upload count, join date)
- License badge (legal clarity)
- Component count (complexity indicator)
- Footprint completeness (✓ All footprints assigned)

### 4. Frictionless Copy
**Principle**: One click to get what you need

```javascript
// Copy button implementation
async function copyToClipboard(sexpr) {
  await navigator.clipboard.writeText(sexpr);
  showToast("✓ Copied to clipboard! Paste into KiCad.");
}
```

**No multi-step process**. Click → Copied → Paste in KiCad.

### 5. Smart Defaults
**Principle**: Reduce decision fatigue

When uploading:
- **Suggested title**: Extract from first component or label
- **Auto-tags**: Parse component types (opamp, microcontroller, etc.)
- **Default license**: CERN-OHL-S (with explanation)
- **Auto-category**: Detect from components (Power if voltage regulator, etc.)

### 6. Contextual Help
**Principle**: Help exactly when needed

```
License selection:
[?] Not sure which license to choose?
    • Use CERN-OHL-S for hardware you want others to share improvements
    • Use MIT for maximum freedom (commercial use OK)
    • See detailed license guide →
```

### 7. Search Optimization

**Features**:
- **Autocomplete**: Suggest as user types
- **Fuzzy Matching**: "lm385" finds "LM358"
- **Component Search**: Find circuits containing specific ICs
- **Tag Filtering**: Click tag to filter
- **Sort Options**: Relevance, Most Copied, Recent, Favorites

**Search UX**:
```javascript
// Debounced search with autocomplete
const searchWithDebounce = debounce(async (query) => {
  if (query.length < 2) return;

  const suggestions = await fetch(`/api/search/suggest?q=${query}`);
  showAutocomplete(suggestions);
}, 300);
```

Show results as user types (300ms debounce).

### 8. Mobile-Responsive Design
**Principle**: Works on all devices

While primary use case is desktop (KiCad is desktop):
- Mobile users can browse, favorite, share links
- Upload might be desktop-only (OK!)
- Search and discovery work great on mobile
- Detail page adapts (stacked layout)

### 9. Accessibility

**WCAG 2.1 AA Compliance**:
- ✓ Keyboard navigation (Tab, Enter, Esc)
- ✓ Screen reader support (ARIA labels)
- ✓ Color contrast 4.5:1 minimum
- ✓ Focus indicators visible
- ✓ Alt text for preview images

Example:
```html
<button
  aria-label="Copy circuit to clipboard"
  class="copy-btn"
  onClick={handleCopy}
>
  📋 Copy to Clipboard
</button>
```

### 10. Error Handling

**Graceful Degradation**:

```
Upload validation errors:
❌ Invalid S-expression format
   → Show helpful error: "This doesn't look like a KiCad schematic.
      Make sure you copied from KiCad 6 or later."

❌ Parsing failed
   → Offer: "Try validating your schematic in KiCad first."

❌ File too large
   → "Subcircuit is too large (1.2MB). Max is 1MB.
      Consider splitting into smaller blocks."
```

**Network errors**:
```
⚠️ Upload failed due to network error.
   [Retry] [Save Draft Locally]
```

## Performance Considerations

### Page Load Speed

**Targets**:
- Homepage: <1s Time to Interactive (TTI)
- Search results: <500ms after query
- Detail page: <1.5s TTI

**Techniques**:
1. **Code Splitting**: Load KiCanvas only on detail pages
2. **Image Optimization**: WebP thumbnails, lazy loading
3. **CDN**: Static assets via CDN (Cloudflare, etc.)
4. **Server-Side Rendering**: Next.js SSR for initial page
5. **Caching**: Aggressive caching for public content

### KiCanvas Loading

KiCanvas is ~500KB. Optimize:
```javascript
// Lazy load KiCanvas
import dynamic from 'next/dynamic';

const KiCanvasViewer = dynamic(() => import('@/components/KiCanvasViewer'), {
  ssr: false,
  loading: () => <div>Loading viewer...</div>
});
```

### Search Performance

- **Database**: Use PostgreSQL FTS with GIN indexes
- **Caching**: Cache popular searches in Redis (5min TTL)
- **Pagination**: 20 results per page
- **Debouncing**: 300ms on search input

## Delight Moments

Small touches that make the experience memorable:

1. **Confetti Animation**: When user's subcircuit gets 10th copy
2. **Easter Eggs**: Random fun circuit of the day
3. **Badge System**: "First Upload", "10 Copies", "100 Favorites"
4. **Code Syntax Highlighting**: S-expression syntax highlighting in upload box
5. **Keyboard Shortcuts**: `/` to focus search, `C` to copy on detail page
6. **Dark Mode**: Toggle for night owls

## Onboarding Flow

**First-Time User**:
```
1. Land on homepage
   → See featured circuits, clear CTA "Upload Subcircuit"

2. Click "Upload"
   → Prompt to sign in with GitHub
   → "Sign in to upload and save favorites"

3. After sign in
   → Welcome tooltip: "Paste a KiCad schematic to get started!"
   → Link to example S-expression

4. First upload
   → Guided walkthrough: Fill title → Add description → Choose license
   → Celebrate: "🎉 Your first subcircuit is live!"

5. Discovery
   → "Explore popular circuits" suggestion
   → "Follow tags you're interested in"
```

## Gamification (Optional - Phase 2)

Encourage quality uploads and engagement:

- **Upload Badges**: 1st, 10th, 50th upload
- **Copy Milestones**: Circuit gets 10, 100, 1000 copies
- **Reputation Points**: Earn points for uploads, copies, favorites
- **Leaderboard**: Top contributors this month
- **Achievements**: "Well Documented" (all your circuits have descriptions)

**Avoid**: Over-gamification that encourages spam. Focus on quality over quantity.

## Summary

### UX Principles

1. ✓ **Speed**: Fast parsing, instant previews, quick search
2. ✓ **Clarity**: Clear labels, helpful errors, good documentation
3. ✓ **Trust**: Show licenses, attribution, quality signals
4. ✓ **Simplicity**: One-click copy, minimal required fields
5. ✓ **Delight**: Smooth animations, thoughtful details
6. ✓ **Accessibility**: Keyboard nav, screen readers, color contrast
7. ✓ **Mobile**: Responsive design for discovery on any device

### MVP Features (Must-Have)

- [x] Search with autocomplete
- [x] Interactive schematic viewer (KiCanvas)
- [x] One-click copy to clipboard
- [x] Upload with paste
- [x] License selection
- [x] Attribution generation
- [x] User profiles
- [x] Favorite button

### Phase 2 Features (Nice-to-Have)

- [ ] Collections
- [ ] Comments
- [ ] Version history
- [ ] Fork/remix
- [ ] Collaborative editing
- [ ] API for third-party integrations
- [ ] Browser extension for KiCad

This UX design prioritizes the core workflow: **Discover → Copy → Paste** with minimal friction.
