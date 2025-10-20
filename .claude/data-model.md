# CircuitSnips Data Model

Complete documentation of CircuitSnips' database schema, authentication, and storage architecture.

**Last Updated:** 2025-01-20
**Database:** PostgreSQL 15+ (Supabase)
**Schema File:** `supabase/schema.sql`

---

## Table of Contents

1. [Overview](#overview)
2. [Database Tables](#database-tables)
3. [Authentication](#authentication)
4. [Storage Buckets](#storage-buckets)
5. [Row Level Security](#row-level-security)
6. [Triggers & Functions](#triggers--functions)
7. [Indexes](#indexes)
8. [Data Relationships](#data-relationships)
9. [Example Queries](#example-queries)

---

## Overview

CircuitSnips uses **Supabase** (PostgreSQL 15+) for its backend infrastructure:
- **Database**: Relational tables with JSONB support
- **Authentication**: GitHub OAuth via Supabase Auth
- **Storage**: Public buckets for thumbnails and circuit files
- **Search**: PostgreSQL full-text search with `tsvector`
- **Security**: Row Level Security (RLS) policies

### Key Features
- Threaded comments system (up to 3 levels)
- Full-text search across titles, descriptions, and tags
- Auto-incrementing engagement metrics (views, copies, favorites, comments, likes)
- Public/private circuit visibility
- Automatic thumbnail generation in light/dark modes

---

## Database Tables

### 1. profiles

Extends Supabase's `auth.users` with public profile information.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  github_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);
```

**Fields:**
- `id` - UUID, foreign key to `auth.users(id)`, primary identifier
- `username` - Unique username (3-30 chars, alphanumeric + dash/underscore)
- `avatar_url` - URL to user's GitHub avatar
- `bio` - Optional user bio text
- `website` - Optional personal website URL
- `github_url` - Constructed from GitHub OAuth metadata
- `created_at` - Account creation timestamp
- `updated_at` - Last profile update timestamp

**Creation:**
- Automatically created on user signup via `handle_new_user()` trigger
- Username extracted from GitHub OAuth metadata (`user_name`, `preferred_username`, or `login`)
- Duplicates handled by appending random number

---

### 2. circuits

Main table storing circuit metadata and S-expression data.

```sql
CREATE TABLE public.circuits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Storage
  file_path TEXT,
  raw_sexpr TEXT NOT NULL,

  -- Metadata
  component_count INTEGER DEFAULT 0,
  wire_count INTEGER DEFAULT 0,
  net_count INTEGER DEFAULT 0,

  -- Categorization
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  license TEXT DEFAULT 'CERN-OHL-S-2.0',

  -- Engagement
  view_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- Visibility
  is_public BOOLEAN DEFAULT true,

  -- Thumbnails
  thumbnail_light_url TEXT,
  thumbnail_dark_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);
```

**Fields:**
- `id` - Primary UUID identifier
- `slug` - URL-friendly unique identifier (lowercase, alphanumeric + dashes)
- `title` - Circuit name/title
- `description` - Detailed circuit description
- `user_id` - Owner (foreign key to `profiles`)
- `file_path` - Optional Supabase Storage path (nullable)
- `raw_sexpr` - Raw KiCad S-expression data (TEXT)
- `component_count`, `wire_count`, `net_count` - Extracted statistics
- `category` - Circuit category (e.g., "Power Supply", "Audio")
- `tags` - Array of searchable tags
- `license` - Open source hardware license (defaults to CERN-OHL-S-2.0)
- `view_count` - Number of views
- `copy_count` - Number of times copied to clipboard
- `favorite_count` - Number of favorites (auto-updated via trigger)
- `comment_count` - Number of comments (auto-updated via trigger)
- `is_public` - Visibility flag (true = public, false = private)
- `thumbnail_light_url`, `thumbnail_dark_url` - URLs to Supabase Storage thumbnails
- `search_vector` - `tsvector` for full-text search (auto-updated via trigger)

**Supported Licenses:**
- CERN-OHL-S-2.0 (recommended)
- MIT, Apache-2.0, GPL-3.0
- CC-BY-4.0, CC-BY-SA-4.0
- TAPR-OHL-1.0, BSD-2-Clause

---

### 3. circuit_components

Detailed component information extracted from schematics.

```sql
CREATE TABLE public.circuit_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,     -- e.g., "R1", "IC19"
  value TEXT NOT NULL,          -- e.g., "10k", "TPIC8101DWRG4"
  footprint TEXT,               -- e.g., "Resistor_SMD:R_0805_2012Metric"
  lib_id TEXT NOT NULL,         -- e.g., "Device:R"
  uuid TEXT NOT NULL,
  position_x FLOAT,
  position_y FLOAT,
  rotation FLOAT DEFAULT 0,

  UNIQUE(circuit_id, uuid)
);
```

**Fields:**
- `circuit_id` - Parent circuit (CASCADE delete)
- `reference` - Component designator (R1, C2, U3, etc.)
- `value` - Component value (10k, 100nF, LM358, etc.)
- `footprint` - PCB footprint assignment
- `lib_id` - KiCad library symbol ID
- `uuid` - KiCad-generated unique identifier
- `position_x`, `position_y` - Schematic coordinates
- `rotation` - Component rotation angle (degrees)

**Usage:**
- Extracted from S-expression during upload
- Used for component search/filtering
- Displayed on circuit detail page

---

### 4. favorites

Many-to-many relationship between users and circuits.

```sql
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, circuit_id)
);
```

**Fields:**
- `user_id` - User who favorited
- `circuit_id` - Favorited circuit
- `created_at` - When favorited

**Behavior:**
- Unique constraint prevents duplicate favorites
- Auto-updates `circuits.favorite_count` via trigger

---

### 5. circuit_copies

Analytics tracking for circuit copy events.

```sql
CREATE TABLE public.circuit_copies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  copied_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Fields:**
- `circuit_id` - Circuit that was copied
- `user_id` - User who copied (NULL for anonymous)
- `copied_at` - Timestamp of copy event

**Usage:**
- Logged when user clicks "Copy to Clipboard"
- Used for analytics and popularity metrics

---

### 6. circuit_comments

Threaded comments system with support for replies.

```sql
CREATE TABLE public.circuit_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.circuit_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT false,

  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
);
```

**Fields:**
- `circuit_id` - Parent circuit
- `user_id` - Comment author
- `parent_comment_id` - NULL for top-level, UUID for replies (CASCADE delete)
- `content` - Comment text (1-5000 chars)
- `likes_count` - Number of likes (auto-updated via trigger)
- `created_at` - When comment was created
- `updated_at` - When last edited (auto-updated via trigger)
- `is_edited` - True if edited after creation

**Threading:**
- Top-level comments: `parent_comment_id = NULL`
- Replies: `parent_comment_id` points to parent comment
- Max depth enforced at application level (3 levels)
- Deleting a comment deletes all replies (CASCADE)

---

### 7. comment_likes

Tracks which users liked which comments.

```sql
CREATE TABLE public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES public.circuit_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(comment_id, user_id)
);
```

**Fields:**
- `comment_id` - Liked comment
- `user_id` - User who liked
- `created_at` - When liked

**Behavior:**
- Unique constraint prevents duplicate likes
- Auto-updates `circuit_comments.likes_count` via trigger

---

## Authentication

CircuitSnips uses **Supabase Auth** with GitHub OAuth.

### GitHub OAuth Setup

1. **GitHub OAuth App** (configured in Supabase Dashboard):
   - Provider: GitHub
   - Scopes: `user:email`, `read:user`
   - Redirect URLs configured in Supabase

2. **User Metadata Captured:**
   ```typescript
   {
     user_name: string,         // GitHub username
     avatar_url: string,         // GitHub avatar
     preferred_username: string, // Fallback username
     login: string               // Alternate username field
   }
   ```

3. **Profile Creation:**
   - Automatic via `handle_new_user()` trigger
   - Triggered on `auth.users` INSERT
   - Extracts username from metadata
   - Sanitizes to match constraints (alphanumeric + dash/underscore)
   - Handles duplicates by appending random number

### Environment Variables

```env
# In .env.local
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"
```

**Note:** GitHub OAuth credentials are configured in Supabase Dashboard, not in `.env.local`.

### Authentication Flow

```
1. User clicks "Login with GitHub"
2. Redirected to GitHub OAuth
3. GitHub redirects back to /auth/callback
4. Supabase creates auth.users entry
5. handle_new_user() trigger creates profiles entry
6. User redirected to app
```

### Protected Routes

Next.js middleware (`middleware.ts`) protects:
- `/upload` - Requires authentication
- `/profile` - Requires authentication
- `/settings` - Requires authentication

---

## Storage Buckets

CircuitSnips uses **Supabase Storage** for file uploads.

### 1. circuits Bucket

- **Purpose**: Store optional `.kicad_sch` files
- **Access**: Public read, authenticated write
- **Folder Structure**: `{user_id}/{circuit_id}.kicad_sch`

**RLS Policies:**
```sql
-- Anyone can view
USING (bucket_id = 'circuits')

-- Authenticated users can upload
WITH CHECK (bucket_id = 'circuits' AND auth.role() = 'authenticated')

-- Users can update/delete own files
USING (bucket_id = 'circuits' AND auth.uid()::text = (storage.foldername(name))[1])
```

### 2. thumbnails Bucket

- **Purpose**: Store circuit preview thumbnails
- **Access**: Public read, authenticated write
- **Folder Structure**: `{user_id}/{circuit_id}_light.png`, `{circuit_id}_dark.png`

**Thumbnail Generation:**
- Captured client-side using `html2canvas`
- Two versions: light mode and dark mode
- Uploaded during circuit creation
- Displayed on browse page and circuit cards

**RLS Policies:**
- Same as `circuits` bucket
- Public read, owner write/update/delete

---

## Row Level Security

All tables have RLS enabled. Key policies:

### Profiles
```sql
-- Public read
USING (true)

-- Users can update own profile
USING (auth.uid() = id)
```

### Circuits
```sql
-- View public circuits OR own private circuits
USING (is_public = true OR auth.uid() = user_id)

-- Create circuits as authenticated user
WITH CHECK (auth.uid() = user_id)

-- Update/delete own circuits only
USING (auth.uid() = user_id)
```

### Favorites
```sql
-- View all favorites
USING (true)

-- Manage own favorites only
USING (auth.uid() = user_id)
```

### Comments
```sql
-- View all comments
USING (true)

-- Create comments as authenticated user
WITH CHECK (auth.uid() = user_id)

-- Update/delete own comments only
USING (auth.uid() = user_id)
```

### Comment Likes
```sql
-- View all likes
USING (true)

-- Manage own likes only
USING (auth.uid() = user_id)
```

---

## Triggers & Functions

### 1. handle_new_user()

**Purpose:** Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_username TEXT;
BEGIN
  -- Extract username from GitHub metadata
  extracted_username := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'preferred_username',
    NEW.raw_user_meta_data->>'login',
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  -- Sanitize and ensure uniqueness
  extracted_username := regexp_replace(extracted_username, '[^a-zA-Z0-9_-]', '', 'g');

  IF char_length(extracted_username) < 3 THEN
    extracted_username := 'user_' || substring(NEW.id::text from 1 for 8);
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = extracted_username) LOOP
    extracted_username := extracted_username || floor(random() * 100)::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, avatar_url, github_url)
  VALUES (...);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. update_circuit_search_vector()

**Purpose:** Auto-update full-text search index

```sql
CREATE OR REPLACE FUNCTION update_circuit_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Weighting:**
- A: Title (highest relevance)
- B: Description
- C: Tags

### 3. update_circuit_favorite_count()

**Purpose:** Auto-update favorite counter

```sql
CREATE OR REPLACE FUNCTION update_circuit_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circuits SET favorite_count = favorite_count + 1 WHERE id = NEW.circuit_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circuits SET favorite_count = favorite_count - 1 WHERE id = OLD.circuit_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 4. update_circuit_comment_count()

**Purpose:** Auto-update comment counter

```sql
CREATE OR REPLACE FUNCTION update_circuit_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circuits SET comment_count = comment_count + 1 WHERE id = NEW.circuit_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circuits SET comment_count = comment_count - 1 WHERE id = OLD.circuit_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 5. update_comment_likes_count()

**Purpose:** Auto-update comment likes counter

```sql
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circuit_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circuit_comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 6. update_comment_updated_at_column()

**Purpose:** Track comment edits

```sql
CREATE OR REPLACE FUNCTION update_comment_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.is_edited = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Trigger Condition:**
```sql
WHEN (OLD.content IS DISTINCT FROM NEW.content)
```

### 7. increment_circuit_views()

**Purpose:** Manual view count increment

```sql
CREATE OR REPLACE FUNCTION increment_circuit_views(circuit_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.circuits SET view_count = view_count + 1 WHERE id = circuit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:** Called from application when circuit is viewed

### 8. search_circuits()

**Purpose:** Full-text search query

```sql
CREATE OR REPLACE FUNCTION search_circuits(search_query TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title,
    c.description,
    ts_rank(c.search_vector, plainto_tsquery('english', search_query)) as rank
  FROM public.circuits c
  WHERE c.search_vector @@ plainto_tsquery('english', search_query)
  AND c.is_public = true
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## Indexes

### circuits Table
```sql
CREATE INDEX circuits_user_id_idx ON circuits(user_id);
CREATE INDEX circuits_created_at_idx ON circuits(created_at DESC);
CREATE INDEX circuits_tags_idx ON circuits USING GIN(tags);
CREATE INDEX circuits_category_idx ON circuits(category);
CREATE INDEX circuits_is_public_idx ON circuits(is_public) WHERE is_public = true;
CREATE INDEX circuits_search_idx ON circuits USING GIN(search_vector);
```

### circuit_components Table
```sql
CREATE INDEX circuit_components_circuit_id_idx ON circuit_components(circuit_id);
CREATE INDEX circuit_components_lib_id_idx ON circuit_components(lib_id);
```

### favorites Table
```sql
CREATE INDEX favorites_user_id_idx ON favorites(user_id);
CREATE INDEX favorites_circuit_id_idx ON favorites(circuit_id);
```

### circuit_copies Table
```sql
CREATE INDEX circuit_copies_circuit_id_idx ON circuit_copies(circuit_id);
```

### circuit_comments Table
```sql
CREATE INDEX circuit_comments_circuit_id_idx ON circuit_comments(circuit_id);
CREATE INDEX circuit_comments_user_id_idx ON circuit_comments(user_id);
CREATE INDEX circuit_comments_parent_id_idx ON circuit_comments(parent_comment_id);
CREATE INDEX circuit_comments_created_at_idx ON circuit_comments(created_at DESC);
```

### comment_likes Table
```sql
CREATE INDEX comment_likes_comment_id_idx ON comment_likes(comment_id);
CREATE INDEX comment_likes_user_id_idx ON comment_likes(user_id);
```

---

## Data Relationships

```
auth.users (Supabase Auth)
  ↓ 1:1
profiles
  ↓ 1:N
circuits ←──┐
  ↓ 1:N     │
circuit_components

circuits ←──┐
  ↓ M:N     │
favorites   │
  ↓ N:1     │
profiles ───┘

circuits ←──┐
  ↓ 1:N     │
circuit_copies
  ↓ N:1 (optional)
profiles ───┘

circuits ←──┐
  ↓ 1:N     │
circuit_comments (self-referencing for threading)
  ↓ 1:N     │
comment_likes
  ↓ N:1     │
profiles ───┘
```

---

## Example Queries

### Get Circuit with Comments (Nested)

```typescript
const { data } = await supabase
  .from('circuits')
  .select(`
    *,
    user:profiles(id, username, avatar_url),
    comments:circuit_comments(
      *,
      user:profiles(id, username, avatar_url),
      replies:circuit_comments!parent_comment_id(
        *,
        user:profiles(id, username, avatar_url)
      )
    )
  `)
  .eq('slug', 'my-circuit')
  .single();
```

### Search Circuits

```sql
SELECT * FROM search_circuits('op amp');
```

### Get User's Favorites

```sql
SELECT
  c.*,
  p.username as author_username
FROM favorites f
JOIN circuits c ON f.circuit_id = c.id
JOIN profiles p ON c.user_id = p.id
WHERE f.user_id = 'user-uuid'
ORDER BY f.created_at DESC;
```

### Get Most Popular Circuits

```sql
SELECT
  c.*,
  p.username as author_username
FROM circuits c
JOIN profiles p ON c.user_id = p.id
WHERE c.is_public = true
ORDER BY c.favorite_count DESC, c.copy_count DESC
LIMIT 10;
```

### Get User's Activity

```sql
-- User's circuits
SELECT 'circuit' as type, created_at, title FROM circuits WHERE user_id = 'user-uuid'
UNION ALL
-- User's comments
SELECT 'comment', created_at, substring(content from 1 for 50) FROM circuit_comments WHERE user_id = 'user-uuid'
UNION ALL
-- User's favorites
SELECT 'favorite', f.created_at, c.title FROM favorites f JOIN circuits c ON f.circuit_id = c.id WHERE f.user_id = 'user-uuid'
ORDER BY created_at DESC;
```

---

## Migration Notes

### Initial Setup

Run `supabase/schema.sql` in Supabase SQL Editor. This creates all tables, triggers, and policies.

### Idempotency

The schema file uses:
- `CREATE TABLE IF NOT EXISTS`
- `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`
- `DROP POLICY IF EXISTS` before `CREATE POLICY`
- `DO $$ BEGIN ... END $$;` blocks for conditional column additions

**Safe to run multiple times** without errors.

### Existing Databases

For databases with existing data, the schema includes:
- Conditional column additions (checks `information_schema.columns`)
- Default values for new columns
- No destructive operations

---

## Performance Considerations

1. **GIN Indexes**: Used for arrays (`tags`) and `tsvector` (search)
2. **Partial Indexes**: `is_public = true` filter reduces index size
3. **Cascade Deletes**: Automatic cleanup when parent records deleted
4. **Triggers**: Minimal overhead, only fire on actual changes
5. **Connection Pooling**: Handled by Supabase

### Query Optimization Tips

- Use `is_public = true` filter for public queries
- Index on `created_at DESC` for "recent" sorting
- GIN index on `tags` for array overlap queries (`tags && ARRAY['tag1']`)
- Full-text search uses pre-computed `search_vector`

---

## Backup & Recovery

### Supabase Automatic Backups
- Daily backups included in Supabase Pro plan
- Point-in-time recovery available
- Manual backups via Supabase Dashboard

### Manual Backup
```bash
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
```

### Restore
```bash
psql -h db.your-project.supabase.co -U postgres -d postgres < backup.sql
```

---

## Security Best Practices

1. **RLS Policies**: Enforce data access at database level
2. **SECURITY DEFINER**: Used for `handle_new_user()` to bypass RLS during signup
3. **Unique Constraints**: Prevent duplicate favorites, likes, usernames
4. **CHECK Constraints**: Validate data format (username, slug, content length)
5. **Foreign Keys**: Enforce referential integrity
6. **CASCADE Deletes**: Clean up orphaned records automatically

---

**Questions or Issues?**
- Check `supabase/schema.sql` for complete SQL
- Review RLS policies in Supabase Dashboard → Authentication → Policies
- Monitor query performance in Supabase Dashboard → Database → Query Performance
