<div align="center">
  <img src="assets/logo_transparent.png" alt="CircuitSnips Logo" width="200"/>
</div>

# CircuitSnips

**Thingiverse, but for KiCad subcircuits.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Site](https://img.shields.io/badge/Live-circuitsnips.com-blue)](https://circuitsnips.com)

## What is this?

CircuitSnips is a community-driven platform for sharing and discovering KiCad subcircuits. A place where engineers can share their proven circuit designs and help others avoid reinventing the wheel.

The comparison to Thingiverse is deliberate: this is for side projects and quick prototypes, not production designs. If you want to throw an ESP on a board with an AMS1117 and an MCP2515 for a weekend project, these circuits are a reasonable starting point. You should always check everything yourself, but if you're repeatedly throwing boards together with the same jellybean parts, why not have a library to pull from?

**Copy circuit in KiCad → Paste on CircuitSnips → Someone else searches → Copies to their project. That's it.**

### Copy Flow
![Copy Process Demo](public/copy.gif)

### Upload Flow
![Upload Process Demo](public/upload.gif)

## The Problem

As an electronics engineer, I found myself repeatedly designing the same common circuits - voltage regulators, protection circuits, signal conditioning stages, etc. While these patterns exist across thousands of projects, there wasn't a standardized way to share and reuse them within KiCad.

## Features

**Core Functionality**
- Interactive schematic preview using KiCanvas (WebGL viewer)
- Copy to clipboard with embedded attribution
- Download as .kicad_sch file
- GitHub OAuth authentication
- 8 open hardware licenses (CERN-OHL-S-2.0, MIT, Apache-2.0, GPL-3.0, etc.)

**Discovery & Search**
- Weighted full-text search (prioritizes tags > title > description)
- Search autocomplete with live preview
- Browse by popular tags/categories
- Filter by license, component count, quality score
- Sort by relevance, most copied, recent, or favorites

**Community Features**
- Threaded comments with up to 3 levels of replies
- Like/unlike comments
- Edit and delete your own comments
- Favorite circuits to save for later
- User profiles with bio, website, and avatar
- View count and copy count tracking

**Circuit Management**
- Upload circuits via paste or file
- Edit circuit metadata (title, description, tags, license, visibility)
- Delete your own circuits
- Private/public visibility toggle
- Automatic thumbnail generation (light and dark themes)

**KiCanvas Enhancements**
- Theme control from the page (required for thumbnail generation)
- Box selection to copy subsections of circuits
- Particularly useful for bulk-uploaded full sheets - select just the subcircuit you need

## Technical Implementation

**Stack**
- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Backend: Next.js API routes (RESTful)
- Database & Auth: Supabase (PostgreSQL)
- Storage: Cloudflare R2 (thumbnails and schematics)
- Schematic Viewer: KiCanvas (WebGL)
- Hosting: Vercel

**Key Technical Challenges**

*KiCad File Format*: KiCad uses S-Expressions for both file storage and clipboard data. The KiCanvas viewer wasn't set up to handle 'snips' - when snips are uploaded, they need to be wrapped in everything required to make a valid kicad_sch file. References to components on other sheets are blocked to ensure compatibility.

*Search*: Full-text search across circuit descriptions and component lists with weighted ranking.

*Preview Generation*: Visual thumbnails of circuit schematics in both light and dark themes.

## Initial Data: The Bootstrapping Problem

A platform like this is useless without content, but nobody will contribute to an empty site. To break this chicken-and-egg problem, GitHub was scraped for kicad_sch files, classified by version and license, with attribution determined.

The kicad_sch S-Expressions were flattened using a tokenizer, then fed into Gemini Flash 2.5 to extract and rank subcircuits. This gave us **4,230+ schematic files** with correct licenses and attribution, at an API cost of under £10.

The scraped collection includes circuits from automotive projects, medical devices, and hardware that's been to space. The classifier grades circuits on quality, which affects search ranking. There's a toggle to hide bulk uploads entirely from browse and search for users who prefer curated content only.

If users don't wish for their schematics to be included, there's a one-click report that doesn't require login.

## Roadmap

- KiCad plugin integration
- Automated testing and validation of uploaded circuits
- Support for other EDA tools
- Analytics dashboard (copy tracking, engagement metrics)
- Email notifications for comments and replies
- Circuit versioning and revision history
- "I Built This" section for user-submitted build photos
- Collections/playlists for organizing circuits

## Running Locally

```bash
git clone https://github.com/MichaelAyles/kicad-library.git
cd kicad-library
npm install
cp .env.example .env.local
# Add your Supabase URL and keys to .env.local
npm run dev
```

Database setup: Create a Supabase project, then run `supabase/setup.sql` in the SQL editor. It's idempotent - safe to run multiple times.

## Contributing

Fork it, make your changes, send a PR. Use conventional commits if you can.

Before committing:
- `npm run build` should pass
- `npm run lint` should pass

## Licenses

**Platform code**: MIT

**Uploaded circuits**: Users pick from CERN-OHL-S-2.0, MIT, CC-BY-4.0, CC-BY-SA-4.0, GPL-3.0, Apache-2.0, TAPR-OHL-1.0, or BSD-2-Clause

## Credits

- [KiCad](https://www.kicad.org/) for existing
- [KiCanvas](https://github.com/theacodes/kicanvas) for the WebGL viewer
- Everyone who shares their circuits

## Links

- **Live site**: https://circuitsnips.com
- **Blog post**: [Building CircuitSnips](https://www.mikeayles.com/#circuitsnips-com)
- **Report bugs**: [GitHub Issues](https://github.com/MichaelAyles/kicad-library/issues)

## Contact

Questions or feedback? Open an issue or reach out at info@circuitsnips.com
