# Data Model & Database Schema

## Database Choice: PostgreSQL

### Why PostgreSQL?

1. **JSONB Support**: Store S-expression parsed data with full indexing
2. **Full-Text Search**: Built-in FTS with tsvector and GIN indexes
3. **Array Types**: Native support for tags[], component lists
4. **ACID Compliance**: Data integrity for user uploads
5. **Mature Ecosystem**: Excellent ORMs (Prisma, Drizzle, TypeORM)
6. **Performance**: Excellent query optimization, especially with proper indexes

### PostgreSQL Extensions to Enable

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram similarity for autocomplete
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Additional crypto functions
```

## Complete Schema

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- OAuth Data (GitHub)
    github_id INTEGER UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    profile_url TEXT,
    name VARCHAR(255),

    -- Bio/Profile
    bio TEXT,
    website VARCHAR(500),
    location VARCHAR(255),

    -- OAuth Token (encrypted)
    access_token TEXT,                              -- GitHub access token (encrypted)
    refresh_token TEXT,

    -- Settings
    email_notifications BOOLEAN DEFAULT true,
    public_profile BOOLEAN DEFAULT true,

    -- Stats
    subcircuit_count INTEGER DEFAULT 0,
    total_copies_received INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_username ON users(username);
```

### Subcircuits Table

```sql
CREATE TABLE subcircuits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Identifiers
    slug VARCHAR(255) NOT NULL,                     -- URL-friendly: "lm358-opamp-circuit"
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Raw S-Expression Data
    sexpr_raw TEXT NOT NULL,                        -- Original pasted S-expression

    -- Parsed S-Expression (full AST)
    sexpr_parsed JSONB NOT NULL,                   -- Complete parsed tree

    -- Extracted Metadata (for fast queries without parsing)
    metadata JSONB NOT NULL,                        -- See metadata schema below

    -- Categorization
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),                          -- 'power', 'amplifier', 'digital', etc.

    -- License
    license VARCHAR(50) NOT NULL,                   -- 'MIT', 'CC-BY-4.0', 'CERN-OHL-S-2.0', etc.
    license_notes TEXT,

    -- Rendering
    preview_svg TEXT,                               -- Inline SVG or URL to storage
    thumbnail_url TEXT,                             -- Small preview image URL
    has_preview BOOLEAN DEFAULT false,

    -- Version Info
    kicad_version INTEGER,                          -- e.g., 20230121 (from file)
    format_version VARCHAR(20),                     -- e.g., "6.0", "7.0"

    -- Search
    search_vector TSVECTOR,                         -- Full-text search vector

    -- Stats
    view_count INTEGER DEFAULT 0,
    copy_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,

    -- Visibility
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,              -- Admin can feature high-quality circuits

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(user_id, slug),
    CHECK (char_length(title) >= 3),
    CHECK (char_length(description) <= 5000)
);

-- Indexes
CREATE INDEX idx_subcircuits_user ON subcircuits(user_id);
CREATE INDEX idx_subcircuits_slug ON subcircuits(slug);
CREATE INDEX idx_subcircuits_tags ON subcircuits USING GIN(tags);
CREATE INDEX idx_subcircuits_category ON subcircuits(category);
CREATE INDEX idx_subcircuits_license ON subcircuits(license);
CREATE INDEX idx_subcircuits_search ON subcircuits USING GIN(search_vector);
CREATE INDEX idx_subcircuits_metadata ON subcircuits USING GIN(metadata jsonb_path_ops);
CREATE INDEX idx_subcircuits_created ON subcircuits(created_at DESC);
CREATE INDEX idx_subcircuits_popular ON subcircuits(copy_count DESC);
CREATE INDEX idx_subcircuits_public ON subcircuits(is_public) WHERE is_public = true;

-- Full-text search trigger
CREATE OR REPLACE FUNCTION subcircuits_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subcircuits_search_update
BEFORE INSERT OR UPDATE ON subcircuits
FOR EACH ROW EXECUTE FUNCTION subcircuits_search_trigger();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subcircuits_updated_at
BEFORE UPDATE ON subcircuits
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Metadata JSONB Schema

Stored in `subcircuits.metadata` column:

```typescript
interface SubcircuitMetadata {
  // Component inventory
  components: Array<{
    reference: string;          // "R1", "U2", "C5"
    value: string;              // "10k", "LM358", "100nF"
    footprint: string;          // "Resistor_SMD:R_0805_2012Metric"
    lib_id: string;             // "Device:R"
    description?: string;        // From datasheet property
    manufacturer?: string;
    part_number?: string;
    uuid: string;
    position: { x: number; y: number; angle: number };
    properties: Record<string, string>;  // All other properties
  }>;

  // Unique component types (for search/filter)
  uniqueComponents: Array<{
    lib_id: string;             // "Device:R"
    count: number;              // How many of this type
    values: string[];           // ["10k", "100k", "1M"]
  }>;

  // Net list
  nets: Array<{
    name: string;               // "VCC", "GND", "SIGNAL"
    type: 'net_label' | 'global_label' | 'hierarchical_label';
    labelCount: number;
  }>;

  // Interface (hierarchical labels = ports)
  interface: Array<{
    name: string;               // "VIN", "VOUT", "SCL", "SDA"
    direction: 'input' | 'output' | 'bidirectional' | 'tri_state' | 'passive';
    position: { x: number; y: number };
  }>;

  // Statistics
  stats: {
    componentCount: number;
    uniqueComponentCount: number;
    wireCount: number;
    netCount: number;
    labelCount: number;
    hierarchicalLabelCount: number;
  };

  // Bounding box (for rendering size estimation)
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };

  // Footprint summary
  footprints: {
    assigned: number;           // Components with footprints
    unassigned: number;         // Components without
    types: string[];            // Unique footprint names
  };

  // Warnings/issues
  warnings?: string[];          // "Missing footprint on R5", etc.
}
```

Example metadata query:
```sql
-- Find circuits with LM358 op-amp
SELECT * FROM subcircuits
WHERE metadata @> '{"uniqueComponents": [{"lib_id": "Amplifier_Operational:LM358"}]}';

-- Find circuits with 10+ components
SELECT * FROM subcircuits
WHERE (metadata->'stats'->>'componentCount')::int > 10;

-- Find circuits with specific footprint
SELECT * FROM subcircuits
WHERE metadata->'footprints'->'types' ? 'Resistor_SMD:R_0805_2012Metric';
```

### Collections Table (Optional - Phase 2)

Allow users to organize subcircuits into collections:

```sql
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL,

    is_public BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, slug)
);

CREATE TABLE collection_subcircuits (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    subcircuit_id UUID REFERENCES subcircuits(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT,

    PRIMARY KEY (collection_id, subcircuit_id)
);

CREATE INDEX idx_collection_subcircuits_collection ON collection_subcircuits(collection_id);
CREATE INDEX idx_collection_subcircuits_subcircuit ON collection_subcircuits(subcircuit_id);
```

### Favorites Table

Track which circuits users have favorited:

```sql
CREATE TABLE favorites (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subcircuit_id UUID REFERENCES subcircuits(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, subcircuit_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_subcircuit ON favorites(subcircuit_id);

-- Trigger to update favorite_count on subcircuits
CREATE OR REPLACE FUNCTION update_favorite_count() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE subcircuits SET favorite_count = favorite_count + 1
        WHERE id = NEW.subcircuit_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE subcircuits SET favorite_count = favorite_count - 1
        WHERE id = OLD.subcircuit_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER favorites_count_update
AFTER INSERT OR DELETE ON favorites
FOR EACH ROW EXECUTE FUNCTION update_favorite_count();
```

### Copy Events Table

Track when circuits are copied (analytics + sorting by popularity):

```sql
CREATE TABLE copy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcircuit_id UUID NOT NULL REFERENCES subcircuits(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL if not logged in
    ip_address INET,                                        -- For rate limiting
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_copy_events_subcircuit ON copy_events(subcircuit_id);
CREATE INDEX idx_copy_events_user ON copy_events(user_id);
CREATE INDEX idx_copy_events_created ON copy_events(created_at);

-- Trigger to update copy_count and user stats
CREATE OR REPLACE FUNCTION update_copy_count() RETURNS trigger AS $$
BEGIN
    -- Increment subcircuit copy count
    UPDATE subcircuits
    SET copy_count = copy_count + 1
    WHERE id = NEW.subcircuit_id;

    -- Increment user's total_copies_received
    UPDATE users
    SET total_copies_received = total_copies_received + 1
    WHERE id = (SELECT user_id FROM subcircuits WHERE id = NEW.subcircuit_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER copy_events_count_update
AFTER INSERT ON copy_events
FOR EACH ROW EXECUTE FUNCTION update_copy_count();
```

### Comments Table (Optional - Phase 2)

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcircuit_id UUID NOT NULL REFERENCES subcircuits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,  -- For threaded comments

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)
);

CREATE INDEX idx_comments_subcircuit ON comments(subcircuit_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
```

### Tags Table (Optional - for autocomplete)

Denormalized tag tracking for autocomplete:

```sql
CREATE TABLE tag_stats (
    tag VARCHAR(100) PRIMARY KEY,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tag_stats_usage ON tag_stats(usage_count DESC);
CREATE INDEX idx_tag_stats_name ON tag_stats(tag varchar_pattern_ops);  -- For LIKE queries

-- Trigger to update tag_stats when subcircuit tags change
CREATE OR REPLACE FUNCTION update_tag_stats() RETURNS trigger AS $$
DECLARE
    tag TEXT;
BEGIN
    -- Handle new tags
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        FOREACH tag IN ARRAY NEW.tags
        LOOP
            INSERT INTO tag_stats (tag, usage_count, last_used)
            VALUES (tag, 1, NOW())
            ON CONFLICT (tag) DO UPDATE
            SET usage_count = tag_stats.usage_count + 1,
                last_used = NOW();
        END LOOP;
    END IF;

    -- Handle removed tags
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        FOREACH tag IN ARRAY OLD.tags
        LOOP
            UPDATE tag_stats
            SET usage_count = usage_count - 1
            WHERE tag_stats.tag = tag;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tag_stats_update
AFTER INSERT OR UPDATE OR DELETE ON subcircuits
FOR EACH ROW EXECUTE FUNCTION update_tag_stats();
```

### Sessions Table (for NextAuth.js)

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
```

## ORM/Query Builder Choice

### Option 1: Prisma (Recommended)

**Pros**:
- Excellent TypeScript support with generated types
- Great DX with Prisma Studio for DB browsing
- Migrations handled automatically
- Good documentation

**Cons**:
- Can be slower than raw SQL for complex queries
- Less flexible for JSONB operations

**Schema Example**:
```prisma
model Subcircuit {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  title         String
  description   String?
  sexprRaw      String   @map("sexpr_raw") @db.Text
  sexprParsed   Json     @map("sexpr_parsed")
  metadata      Json
  tags          String[]
  license       String
  searchVector  Unsupported("tsvector")?  @map("search_vector")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  user          User     @relation(fields: [userId], references: [id])
  favorites     Favorite[]
  copyEvents    CopyEvent[]

  @@index([userId])
  @@index([tags], type: Gin)
  @@map("subcircuits")
}
```

### Option 2: Drizzle ORM

**Pros**:
- Lighter weight than Prisma
- Better raw SQL support
- Excellent TypeScript inference
- More control over queries

**Cons**:
- Smaller ecosystem
- Less tooling (no Studio equivalent)

### Option 3: Kysely

**Pros**:
- Type-safe SQL query builder
- Very close to raw SQL
- Excellent for complex queries

**Cons**:
- More verbose
- No schema management

**Recommendation**: **Prisma** for MVP (fast development), consider Drizzle if we need more control.

## Example Queries

### Search Subcircuits

```sql
-- Full-text search with ranking
SELECT
    s.*,
    u.username,
    u.avatar_url,
    ts_rank(s.search_vector, query) AS rank
FROM subcircuits s
JOIN users u ON s.user_id = u.id
CROSS JOIN plainto_tsquery('english', 'voltage regulator') AS query
WHERE s.search_vector @@ query
  AND s.is_public = true
ORDER BY rank DESC, s.copy_count DESC
LIMIT 20;

-- Tag-based search with autocomplete
SELECT * FROM subcircuits
WHERE tags && ARRAY['power-supply', 'buck-converter']
ORDER BY created_at DESC;

-- Component search (find circuits using specific IC)
SELECT * FROM subcircuits
WHERE metadata @> '{"uniqueComponents": [{"lib_id": "Regulator_Linear:LM7805"}]}'
ORDER BY copy_count DESC;

-- Autocomplete tags
SELECT tag, usage_count
FROM tag_stats
WHERE tag ILIKE 'pow%'
ORDER BY usage_count DESC
LIMIT 10;
```

### User Profile

```sql
-- Get user with their subcircuits
SELECT
    u.*,
    json_agg(
        json_build_object(
            'id', s.id,
            'title', s.title,
            'copy_count', s.copy_count,
            'created_at', s.created_at
        ) ORDER BY s.created_at DESC
    ) AS subcircuits
FROM users u
LEFT JOIN subcircuits s ON u.id = s.user_id AND s.is_public = true
WHERE u.username = 'johndoe'
GROUP BY u.id;
```

### Analytics

```sql
-- Most popular circuits this month
SELECT
    s.id,
    s.title,
    COUNT(ce.id) AS copies_this_month,
    s.copy_count AS total_copies
FROM subcircuits s
LEFT JOIN copy_events ce ON s.id = ce.subcircuit_id
    AND ce.created_at >= NOW() - INTERVAL '30 days'
GROUP BY s.id
ORDER BY copies_this_month DESC
LIMIT 10;

-- Trending tags
SELECT
    tag,
    COUNT(*) AS circuit_count
FROM subcircuits,
LATERAL unnest(tags) AS tag
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tag
ORDER BY circuit_count DESC
LIMIT 20;
```

## Data Validation

### Application-Level Validation

```typescript
import { z } from 'zod';

const SubcircuitCreateSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  sexprRaw: z.string().min(10).max(1_000_000),  // 1MB limit
  tags: z.array(z.string().max(50)).max(10),
  license: z.enum(['MIT', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CERN-OHL-S-2.0', 'TAPR-OHL-1.0']),
  isPublic: z.boolean().default(true),
});

// Metadata validation
const ComponentSchema = z.object({
  reference: z.string(),
  value: z.string(),
  footprint: z.string(),
  lib_id: z.string(),
  uuid: z.string().uuid(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    angle: z.number(),
  }),
});

const MetadataSchema = z.object({
  components: z.array(ComponentSchema),
  uniqueComponents: z.array(z.object({
    lib_id: z.string(),
    count: z.number().int().positive(),
    values: z.array(z.string()),
  })),
  stats: z.object({
    componentCount: z.number().int().nonnegative(),
    wireCount: z.number().int().nonnegative(),
    netCount: z.number().int().nonnegative(),
  }),
  // ... etc
});
```

## Migrations

Using Prisma migrations:

```bash
# Create initial migration
npx prisma migrate dev --name init

# Apply to production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

## Backup Strategy

1. **Automated Daily Backups**: PostgreSQL pg_dump
2. **Point-in-Time Recovery**: WAL archiving
3. **Replica**: Read replica for high availability
4. **Export Feature**: Allow users to export all their data (GDPR compliance)

## Performance Optimization

1. **Indexes**: Created on all frequently queried columns
2. **JSONB Indexing**: GIN indexes on metadata
3. **Partial Indexes**: `WHERE is_public = true` for public queries
4. **Connection Pooling**: PgBouncer or Prisma's built-in pooling
5. **Query Optimization**: Use EXPLAIN ANALYZE for slow queries
6. **Caching**: Redis for frequent queries (top circuits, trending tags)

## Summary

### Key Design Decisions

1. **PostgreSQL JSONB**: Store both raw and parsed S-expressions
2. **Metadata Extraction**: Denormalize common queries into metadata JSONB
3. **Full-Text Search**: Built-in PostgreSQL FTS with GIN indexes
4. **Triggers**: Auto-update search vectors, counts, timestamps
5. **Normalization**: Balance between normalized (users, favorites) and denormalized (metadata)
6. **UUID Primary Keys**: Better for distributed systems, no sequence contention
7. **Soft Deletes** (optional): Consider adding `deleted_at` for recovery
8. **Audit Trail** (optional): Consider adding version history table

This schema supports the MVP and scales to 100k+ subcircuits with proper indexing and caching.
