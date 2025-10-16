# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: CircuitSnips

CircuitSnips is an open-source platform for sharing reusable KiCad schematic subcircuits. Users copy circuits from KiCad (S-expressions), upload with metadata and licensing, and others can search and paste them directly into their projects.

**Status**: Planning phase complete, ready for MVP development
**Deployment**: circuitsnips.mikeayles.com (MVP) → circuitsnips.io (production)

## Architecture Overview

### Monorepo Structure (Next.js)
- **Frontend + Backend in one repo**: Next.js 14 with App Router
- **API Routes as Backend**: `/app/api/*` handles all server logic (no separate Express server)
- **Vercel Deployment**: Serverless functions for API, edge for frontend
- **Database**: PostgreSQL 15+ with JSONB for S-expression storage

### Key Technologies
- **Next.js 14**: App Router, React Server Components, TypeScript
- **KiCanvas**: MIT-licensed WebGL schematic viewer (https://github.com/theacodes/kicanvas)
- **Prisma ORM**: Database schema and migrations
- **NextAuth.js**: GitHub OAuth authentication
- **PostgreSQL**: JSONB columns, full-text search (tsvector + GIN indexes)
- **Tailwind CSS + shadcn/ui**: UI components

## Development Commands

```bash
# Setup
npm install                     # Install dependencies
cp .env.example .env.local      # Create environment file
npx prisma migrate dev          # Run database migrations
npx prisma generate             # Generate Prisma client
npm run seed                    # Seed database with sample circuits

# Development
npm run dev                     # Start Next.js dev server (http://localhost:3000)
npm run build                   # Production build
npm start                       # Start production server

# Database
npx prisma studio              # Open Prisma Studio (DB GUI)
npx prisma migrate dev --name <migration-name>  # Create new migration
npx prisma db push             # Push schema changes without migration
npx prisma db seed             # Run seed script

# Testing (to be implemented)
npm test                       # Run all tests
npm run test:watch            # Watch mode
npm run test:unit             # Unit tests only
npm run test:e2e              # E2E tests

# Linting & Formatting
npm run lint                  # ESLint
npm run format               # Prettier
```

## Core Data Model

### KiCad S-Expression Format
- **Key Insight**: KiCad 6+ uses text-based S-expressions (Lisp-like syntax)
- **Clipboard**: When you copy in KiCad, raw S-expression text goes to clipboard
- **Self-Contained**: KiCad 6+ embeds all symbol definitions in schematics
- **Includes**: Symbols, wires, labels, footprint assignments
- **Excludes**: PCB layout (separate `.kicad_pcb` files)

### Database Schema (Prisma)
Primary tables:
- **users**: GitHub OAuth data, profile, stats
- **subcircuits**: Raw S-expression + parsed JSONB + metadata
- **favorites**: User favorites (many-to-many)
- **copy_events**: Analytics for copy actions
- **sessions**: NextAuth session storage

Key patterns:
- Store both `sexpr_raw` (TEXT) and `sexpr_parsed` (JSONB)
- Extract metadata (components, nets, bounding box) into separate JSONB column for fast queries
- Use PostgreSQL full-text search with `tsvector` for title/description/tags
- GIN indexes on JSONB columns and search vectors

See `.claude/data-model.md` for complete schema with SQL.

## S-Expression Parser

Location: `lib/parser.ts` (to be created)

Requirements:
- Parse KiCad S-expression format (version 20211014+)
- Validate structure (check for required fields)
- Extract metadata:
  - Component list (reference, value, footprint, lib_id)
  - Net list (labels, global labels, hierarchical labels)
  - Bounding box (for rendering size)
  - Statistics (component count, wire count)
- Regenerate UUIDs on paste to avoid conflicts
- Embed attribution in comments when copying

Example metadata structure in TypeScript:
```typescript
interface SubcircuitMetadata {
  components: Array<{
    reference: string;      // "R1", "U2"
    value: string;          // "10k", "LM358"
    footprint: string;      // "Resistor_SMD:R_0805_2012Metric"
    lib_id: string;         // "Device:R"
    uuid: string;
    position: { x: number; y: number; angle: number };
  }>;
  nets: Array<{ name: string; type: string; }>;
  stats: { componentCount: number; wireCount: number; netCount: number; };
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number; };
}
```

## API Design (Next.js API Routes)

RESTful endpoints in `/app/api/`:

```
GET    /api/subcircuits              # List with search/filter
GET    /api/subcircuits/[id]         # Get single subcircuit
POST   /api/subcircuits              # Upload (auth required)
PUT    /api/subcircuits/[id]         # Update (auth, owner only)
DELETE /api/subcircuits/[id]         # Delete (auth, owner only)
POST   /api/subcircuits/[id]/copy    # Track copy event
GET    /api/search?q=...&tags=...    # Search endpoint
GET    /api/users/[username]         # User profile
```

Authentication: Use NextAuth.js middleware to protect routes.

## Licensing System

### Platform License
- **MIT** for the codebase itself

### Circuit Licenses (User Uploads)
Support 8 open source hardware licenses:
- **CERN-OHL-S-2.0** (recommended default - hardware-specific, copyleft)
- MIT
- CC-BY-4.0
- CC-BY-SA-4.0
- GPL-3.0
- Apache-2.0
- TAPR-OHL-1.0
- BSD-2-Clause

### Attribution Embedding
When user copies a circuit, automatically embed attribution in S-expression comments:
```scheme
(kicad_sch (version 20230121) (generator "CircuitSnips")
  (title "LM358 Op-Amp Circuit")
  (comment 1 "Author: @username")
  (comment 2 "Source: https://circuitsnips.mikeayles.com/circuits/abc123")
  (comment 3 "License: CERN-OHL-S-2.0")
  (comment 4 "Downloaded: 2025-01-15")
  ...
)
```

## KiCanvas Integration

**Library**: https://github.com/theacodes/kicanvas (MIT licensed)

Usage:
- Load dynamically on detail pages only (lazy load, ~500KB)
- Supports KiCad 6+ files
- Interactive zoom/pan/select
- Renders to Canvas/WebGL

Implementation pattern:
```typescript
import dynamic from 'next/dynamic';

const KiCanvasViewer = dynamic(() => import('@/components/KiCanvasViewer'), {
  ssr: false,
  loading: () => <div>Loading viewer...</div>
});
```

## Search Implementation

Use PostgreSQL full-text search:
1. **tsvector column** on subcircuits table
2. **GIN index** for fast lookups
3. **Trigger** to auto-update search vector on INSERT/UPDATE
4. Weight: title (A), description (B), tags (C)

Query pattern:
```sql
SELECT * FROM subcircuits
WHERE search_vector @@ plainto_tsquery('english', $query)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $query)) DESC, copy_count DESC;
```

Also support:
- Component search (JSONB query on metadata)
- Tag filtering (array overlap `tags && ARRAY['tag1', 'tag2']`)
- License filtering
- Sort by: relevance, most copied, recent, favorites

## Environment Variables

Required in `.env.local`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/circuitsnips"
GITHUB_ID="your_github_client_id"
GITHUB_SECRET="your_github_client_secret"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate_with_openssl_rand_base64_32"
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

GitHub OAuth setup:
1. Go to https://github.com/settings/developers
2. Create new OAuth App
3. Homepage URL: `http://localhost:3000` (dev) or `https://circuitsnips.mikeayles.com` (prod)
4. Callback URL: `http://localhost:3000/api/auth/callback/github`

## Code Style & Conventions

- **TypeScript**: Strict mode, no `any` types
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- **File naming**: kebab-case for files, PascalCase for React components
- **Formatting**: ESLint + Prettier (auto-format on save)
- **Never commit**: `.env.local`, `node_modules`, build artifacts

## Commit Rules (CRITICAL)

**NEVER commit code if:**
- `npm run build` fails (TypeScript or build errors)
- `npm run lint` shows errors (warnings may be acceptable with justification)
- Development server crashes on startup
- There are type checking errors: `npx tsc --noEmit`

**Pre-commit verification process:**
1. Run `npm run build` - must succeed
2. Run `npm run lint` - must pass (zero errors)
3. Review changes with `git diff`
4. Write conventional commit message
5. Only then commit and push

See `.claude/rules.md` for complete commit requirements and best practices.

## Planning Documentation

Comprehensive planning docs in `.claude/`:
- **technical-architecture.md**: System design, tech stack rationale
- **file-format-analysis.md**: KiCad S-expression format deep dive
- **data-model.md**: Complete PostgreSQL schema with SQL examples
- **legal-and-licensing.md**: OSHWA compliance, license options, GDPR
- **user-experience.md**: User journeys, UI mockups, UX patterns
- **competitive-analysis.md**: Market gaps, differentiation, monetization

Read these for context before implementing features.

## MVP Checklist (Current Phase)

Priority features:
- [ ] Next.js project setup with TypeScript + Tailwind
- [ ] Prisma schema implementation (see `.claude/data-model.md`)
- [ ] GitHub OAuth with NextAuth.js
- [ ] S-expression parser with validation
- [ ] Upload flow: paste → parse → extract metadata → save
- [ ] Detail page with KiCanvas viewer
- [ ] One-click copy to clipboard (with attribution embedding)
- [ ] Search page with PostgreSQL FTS
- [ ] User profile pages
- [ ] Favorite button functionality

## Key Constraints & Decisions

1. **KiCad 6+ Only**: No support for legacy `.sch` format (pre-v6)
2. **Single-Sheet Only (MVP)**: No hierarchical sheets initially
3. **No PCB Layout**: Schematics only, PCB data is separate
4. **GitHub OAuth Required**: No email/password auth
5. **Public by Default**: All uploads are public (private circuits in Phase 2)
6. **License Required**: Users must choose license on upload
7. **No Editing**: Once uploaded, circuits are immutable (versioning in Phase 2)

## Testing Strategy (To Be Implemented)

### Unit Tests
- S-expression parser validation
- Metadata extraction accuracy
- License validation logic
- Search query building

### Integration Tests
- Database operations (CRUD)
- API endpoints (with test DB)
- Authentication flows

### E2E Tests (Playwright)
- Upload flow (paste → preview → publish)
- Search → view → copy flow
- GitHub OAuth flow
- Favorite/unfavorite

## Performance Targets

- **Homepage**: <1s Time to Interactive
- **Search results**: <500ms after query
- **Detail page**: <1.5s TTI (including KiCanvas load)
- **Upload preview**: <500ms parse time

Optimization techniques:
- Server-side rendering for SEO
- Code splitting (lazy load KiCanvas)
- CDN for static assets
- PostgreSQL connection pooling
- React Query for client-side caching

## Deployment (Vercel)

1. Connect GitHub repo to Vercel
2. Configure environment variables in dashboard
3. Set build command: `npm run build` (default)
4. Root directory: `.` (monorepo root)
5. Custom domain: circuitsnips.mikeayles.com

Database: Use Neon (serverless PostgreSQL) or Railway
- Neon free tier: 500MB, good for MVP
- Add DATABASE_URL to Vercel environment variables

## Common Gotchas

1. **UUIDs in S-expressions**: Don't validate for uniqueness, KiCad regenerates on paste
2. **Line endings**: KiCad uses LF, but Windows Git may convert to CRLF (configure `.gitattributes`)
3. **Large S-expressions**: Set max upload size (1MB recommended)
4. **JSONB queries**: Use `@>` for containment, `?` for key existence
5. **NextAuth session**: Store in database, not JWT (for user stats)

## Resources

- **KiCad S-Expression Spec**: https://dev-docs.kicad.org/en/file-formats/sexpr-schematic/
- **KiCanvas Docs**: https://github.com/theacodes/kicanvas
- **OSHWA Definition**: https://www.oshwa.org/definition/
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js App Router**: https://nextjs.org/docs/app

## Contact

For questions during development, refer to planning docs in `.claude/` first. This is an open-source project with MIT license - contributions welcome!
