# Technical Architecture

## Overview
KiCad Subcircuit Library - A web platform for sharing reusable KiCad schematic subcircuits with search, preview, and one-click copy/paste functionality.

## System Architecture

### High-Level Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │◄────►│   Web App    │◄────►│  Database   │
│             │      │              │      │             │
│ - KiCanvas  │      │ - REST API   │      │ PostgreSQL  │
│ - React UI  │      │ - Parser     │      │ + JSONB     │
│ - Editor    │      │ - Auth       │      │ + FTS       │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Storage    │
                     │              │
                     │ - User Data  │
                     │ - Metadata   │
                     └──────────────┘
```

## Technology Stack

### Frontend
**Framework**: Next.js 14+ (React)
- **Why**: SSR/SSG for SEO, API routes, excellent DX
- **Rendering**: KiCanvas (TypeScript + WebGL) for schematic visualization
  - MIT licensed, supports KiCad 6+
  - Embeddable via API
  - Interactive zoom/pan
- **UI Library**: Tailwind CSS + shadcn/ui components
- **State**: React Query for server state, Zustand for client state
- **Editor**: Monaco Editor (VS Code editor) for S-expression editing with syntax highlighting

### Backend
**Runtime**: Node.js 20+ with TypeScript
**Framework**: Express.js or Fastify
- **Why**: JavaScript/TypeScript consistency with frontend
- **Parser**: Custom S-expression parser (or use existing like `s-expression.js`)
- **Validation**: Zod for schema validation

**Alternative Stack**: Python + FastAPI
- Better S-expression parsing libraries (like `sexpdata`, `hy`)
- Excellent for data processing
- Trade-off: Different language from frontend

**Recommendation**: Node.js/TypeScript for full-stack consistency

### Database
**Primary**: PostgreSQL 15+
- **JSONB columns**: Store parsed S-expression data
- **Full-text search**: Built-in FTS with `tsvector` and GIN indexes
- **Advantages**:
  - Rich querying of nested JSON
  - ACID compliance
  - Excellent indexing for search
  - Mature ecosystem

**Schema Design**:
```sql
subcircuits (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT,
  description TEXT,
  sexpr_raw TEXT,           -- Original S-expression
  sexpr_parsed JSONB,       -- Parsed structure
  metadata JSONB,           -- Component list, net list, etc.
  preview_svg TEXT,         -- Or link to rendered preview
  tags TEXT[],
  license TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  search_vector TSVECTOR    -- For full-text search
)

CREATE INDEX ON subcircuits USING GIN(search_vector);
CREATE INDEX ON subcircuits USING GIN(sexpr_parsed);
CREATE INDEX ON subcircuits USING GIN(tags);
```

### Authentication
**Provider**: GitHub OAuth 2.0
- **Why**:
  - Natural fit for developer/maker community
  - Users already have accounts
  - Can pull username, avatar, profile
- **Implementation**: NextAuth.js (Auth.js)
- **Session storage**: Database sessions (PostgreSQL)
- **Security**: Store client secret in environment variables, NEVER in code

### File Storage
**Options**:
1. **Database BLOB** (for MVP) - Store SVG previews directly in PostgreSQL
2. **Object Storage** (for scale) - AWS S3 / Cloudflare R2 / Backblaze B2
   - Store rendered preview images
   - CDN distribution

**Recommendation**: Start with database storage, migrate to object storage if needed

### Search & Discovery
**Search Features**:
- Full-text search on title, description, tags
- Component-based search (find subcircuits containing specific ICs)
- Filter by license type
- Filter by component count
- Sort by popularity (copy count), date, relevance

**Implementation**:
- PostgreSQL FTS with `ts_vector`
- Autocomplete with trigram similarity (`pg_trgm` extension)
- Optional future: Elasticsearch/Typesense for advanced search

### Rendering Pipeline

**On Upload**:
1. Receive S-expression text from user
2. Validate format (check for KiCad 6+ structure)
3. Parse into structured data
4. Extract metadata:
   - Component list
   - Net list
   - Bounding box
   - Footprint assignments
5. Generate preview using:
   - **Option A**: Server-side KiCanvas rendering → save as SVG/PNG
   - **Option B**: Client-side lazy rendering with KiCanvas embed
6. Store raw + parsed + metadata

**On Display**:
- Embed KiCanvas viewer with interactive zoom/pan
- Show component list, net names
- Display copy button → copies raw S-expression to clipboard

## API Design

### RESTful Endpoints

```
GET    /api/subcircuits              # List with search/filter
GET    /api/subcircuits/:id          # Get single subcircuit
POST   /api/subcircuits              # Upload new (auth required)
PUT    /api/subcircuits/:id          # Update (auth required, owner only)
DELETE /api/subcircuits/:id          # Delete (auth required, owner only)
POST   /api/subcircuits/:id/copy     # Track copy count
GET    /api/users/:username          # User profile + their subcircuits

GET    /api/search?q=...&tags=...    # Search endpoint
GET    /api/tags                     # Popular tags
GET    /api/components               # Popular components
```

### Data Flow

**Upload Flow**:
```
User pastes S-expr → Validate → Parse → Extract metadata →
Generate preview → Store in DB → Return subcircuit ID →
Redirect to detail page
```

**Copy Flow**:
```
User clicks "Copy" → Fetch raw S-expr from DB →
Copy to clipboard → Track copy event → Show success toast
```

## Deployment

### Hosting Options

**Option 1: Vercel** (Recommended for MVP)
- Next.js native platform
- Automatic deployments from Git
- Serverless functions for API
- **Database**: Railway PostgreSQL or Neon (serverless Postgres)

**Option 2: Self-hosted**
- VPS (Digital Ocean, Hetzl, etc.)
- Docker containers
- PostgreSQL on same server or managed DB
- Nginx reverse proxy

**Option 3: Cloud (AWS/GCP)**
- More complex but scalable
- ECS/Cloud Run for containers
- RDS/Cloud SQL for database

**Recommendation**: Start with Vercel + Neon for rapid iteration

### CI/CD
- GitHub Actions for tests
- Automatic deployment on merge to main
- Preview deployments for PRs

## Performance Considerations

### Caching Strategy
- **Browser**: Cache KiCanvas library (it's 500KB+)
- **CDN**: Cache SVG previews, static assets
- **Server**: Redis for session storage (optional)
- **Database**: Query result caching with React Query (5min TTL)

### Optimization
- Lazy load KiCanvas only on detail pages
- Paginate search results (20-50 per page)
- Debounce search input (300ms)
- Use Connection pooling for PostgreSQL (pgBouncer)

## Security Considerations

1. **Input Validation**: Sanitize all S-expression input
2. **Rate Limiting**: Prevent spam uploads (10 uploads/hour per user)
3. **CORS**: Restrict API access to known domains
4. **OAuth**: Never expose client secret, use environment variables
5. **XSS**: Sanitize any user-generated content in descriptions
6. **SQL Injection**: Use parameterized queries (ORM handles this)

## Scalability Path

**Phase 1 (0-1k users)**: Vercel + Neon serverless PostgreSQL
**Phase 2 (1k-10k)**: Add Redis cache, CDN for assets
**Phase 3 (10k+)**: Dedicated PostgreSQL, object storage, background job processing

## Technology Alternatives Considered

### Why NOT MongoDB?
- S-expressions are semi-structured but benefit from relational queries
- PostgreSQL JSONB gives us best of both worlds
- Better full-text search out of the box

### Why NOT GraphQL?
- REST is simpler for this use case
- Fewer dependencies
- Better caching with HTTP semantics

### Why KiCanvas over SVG export?
- Interactive viewer (zoom, pan, select components)
- Better user experience
- Still can generate static SVG for SEO/preview thumbnails

## Development Workflow

1. **Local Development**:
   - PostgreSQL in Docker
   - Next.js dev server
   - Hot reload for fast iteration

2. **Testing**:
   - Unit tests: Vitest
   - E2E tests: Playwright
   - API tests: Supertest

3. **Version Control**:
   - Git with conventional commits
   - Feature branches → PR → Review → Merge

## Next Steps

1. Set up Next.js project with TypeScript
2. Integrate KiCanvas library
3. Create S-expression parser
4. Design database schema
5. Implement GitHub OAuth
6. Build upload flow
7. Build search interface
8. Deploy MVP to Vercel
