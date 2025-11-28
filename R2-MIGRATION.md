# R2 Migration Plan

## Overview

This document details the migration of CircuitSnips thumbnail storage from Supabase Storage to Cloudflare R2 for better performance, cost efficiency, and CDN integration.

## Current Status

### Completed Work

#### 1. R2 Bucket Setup
- **Bucket Name**: `circuitsnips`
- **Account ID**: `8a48d886a6cd7ca8fbd53045cde3550c`
- **Public URL**: `https://pub-5cfb1ad5b22e451db2e5711b584b49c9.r2.dev`
- Access credentials configured in `.env.local`

#### 2. R2 Thumbnail Generator App (`r2-thumbgen/`)
A standalone Next.js app for generating and uploading thumbnails:

**Features:**
- Iterator UI to browse all circuits
- Dual KiCanvas preview (light/dark themes)
- Native canvas capture from KiCanvas shadow DOM
- Cyan error detection (rejects failed renders)
- Batch upload capability (1, 10, or all circuits)
- Skip circuits that already have R2 thumbnails
- Real-time R2 status tracking

**API Routes Created:**
| Route | Purpose |
|-------|---------|
| `/api/upload-thumbnail` | Upload light/dark thumbnails to R2 |
| `/api/check-r2-thumbnail` | Check if a circuit has R2 thumbnails |
| `/api/list-r2-thumbnails` | List all circuits with complete R2 thumbnails |
| `/api/schematic/[id]/[filename]` | Serve schematic files for KiCanvas preview |

#### 3. Database Schema Updates
The `circuits` table has columns for R2 URLs:
```sql
thumbnail_light_url TEXT  -- R2 URL for light mode thumbnail
thumbnail_dark_url TEXT   -- R2 URL for dark mode thumbnail
```

These are populated when thumbnails are uploaded to R2.

#### 4. R2 Storage Structure
```
thumbnails/
  {circuit-id}/
    light.png    -- Light theme thumbnail (800x566)
    dark.png     -- Dark theme thumbnail (800x566)
```

#### 5. Thumbnail Specifications
- **Dimensions**: 800 x 566 pixels (A4 landscape aspect ratio)
- **Format**: PNG
- **Quality**: 0.9
- **Themes**:
  - Light: KiCad default theme
  - Dark: Witchhazel theme

---

## Migration Steps for Main Site

### Phase 1: Update Thumbnail Display

**Files to modify:**
```
src/components/CircuitCard.tsx      -- Grid/list thumbnail display
src/app/circuit/[slug]/page.tsx     -- Circuit detail page
src/app/browse/page.tsx             -- Browse page thumbnails
```

**Changes needed:**

1. **CircuitCard.tsx** - Update to use R2 URLs:
```typescript
// Before (Supabase)
const thumbnailUrl = circuit.thumbnail_url
  ? supabase.storage.from('thumbnails').getPublicUrl(circuit.thumbnail_url).data.publicUrl
  : '/placeholder.png';

// After (R2)
const thumbnailUrl = circuit.thumbnail_light_url || circuit.thumbnail_dark_url || '/placeholder.png';
```

2. **Add dark mode support** - Use appropriate thumbnail based on theme:
```typescript
const { theme } = useTheme();
const thumbnailUrl = theme === 'dark'
  ? (circuit.thumbnail_dark_url || circuit.thumbnail_light_url)
  : (circuit.thumbnail_light_url || circuit.thumbnail_dark_url);
```

### Phase 2: Update Upload Flow

**Current flow (Supabase):**
1. User uploads circuit
2. Thumbnail captured client-side
3. Uploaded to Supabase Storage bucket
4. URL stored in database

**New flow (R2):**
1. User uploads circuit
2. Thumbnail captured client-side
3. POST to `/api/upload-thumbnail` with base64 data
4. Server uploads to R2
5. R2 URLs stored in database

**Files to modify:**
```
src/app/upload/page.tsx             -- Upload flow
src/lib/thumbnail.ts                -- Thumbnail capture (copy from r2-thumbgen)
src/app/api/upload-thumbnail/       -- New API route (copy from r2-thumbgen)
```

### Phase 3: Environment Variables

Add to main site `.env.local`:
```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=8a48d886a6cd7ca8fbd53045cde3550c
R2_ACCESS_KEY_ID=aceb713ff1f49c45e8178cefe30d33de
R2_SECRET_ACCESS_KEY=b3fd49002385d64beeacb1ebf6ad8ab9ee7eba2aa4150a854bca7530ce5003ef
R2_BUCKET_NAME=circuitsnips
R2_PUBLIC_URL=https://pub-5cfb1ad5b22e451db2e5711b584b49c9.r2.dev
```

Add to Vercel environment variables for production.

### Phase 4: Data Migration

Run the r2-thumbgen iterator to generate thumbnails for all existing circuits:

1. Start the thumbgen app: `cd r2-thumbgen && npm run dev -- -p 3001`
2. Navigate to http://localhost:3001/iterator
3. Click "Capture & Upload All" with "Skip existing" checked
4. Monitor progress - estimated ~2-3 minutes for 100 circuits

### Phase 5: Deprecate Supabase Storage

After verifying R2 is working:

1. **Remove Supabase storage code** from upload flow
2. **Delete old thumbnails** from Supabase Storage bucket
3. **Remove old columns** if using separate columns (optional cleanup)
4. **Update documentation** to reflect R2 usage

---

## API Reference

### POST /api/upload-thumbnail

Upload thumbnails to R2 and update database.

**Request:**
```json
{
  "circuitId": "uuid",
  "lightDataUrl": "data:image/png;base64,...",
  "darkDataUrl": "data:image/png;base64,..."
}
```

**Response:**
```json
{
  "success": true,
  "circuitId": "uuid",
  "urls": {
    "light": "https://pub-xxx.r2.dev/thumbnails/{id}/light.png",
    "dark": "https://pub-xxx.r2.dev/thumbnails/{id}/dark.png"
  }
}
```

### GET /api/list-r2-thumbnails

List all circuits with complete R2 thumbnails.

**Response:**
```json
{
  "totalLight": 150,
  "totalDark": 150,
  "totalComplete": 148,
  "completeCircuitIds": ["uuid1", "uuid2", ...]
}
```

### GET /api/check-r2-thumbnail?circuitId={id}

Check R2 status for a single circuit.

**Response:**
```json
{
  "circuitId": "uuid",
  "hasR2Thumbnails": true,
  "light": { "exists": true, "url": "...", "size": 45000 },
  "dark": { "exists": true, "url": "...", "size": 52000 }
}
```

---

## Known Issues & Solutions

### 1. KiCanvas Cyan Error Screen
When KiCanvas fails to render, it shows a solid cyan (#00FFFF) screen. The capture code detects this and rejects the thumbnail:
- Samples 9 points across the canvas
- If 8+ are cyan (R<20, G>240, B>240), capture is rejected
- Circuit must be manually reviewed or retried

### 2. Canvas Not Found in Shadow DOM
KiCanvas uses nested shadow DOMs. The capture code:
- Recursively searches up to 5 levels deep
- Looks for `kicanvas-viewer`, `kicanvas-schematic`, `kicanvas-app` components
- Retries up to 5 times with 200ms delay between attempts

### 3. Unescaped Quotes in Comments
Some schematics have malformed comments like:
```
(comment 3 "License: BSD 3-Clause "New" or "Revised" License")
```
The schematic API sanitizes these by replacing inner quotes with single quotes.

---

## Cost Comparison

| Service | Storage | Egress | Operations |
|---------|---------|--------|------------|
| Supabase Free | 1GB | 2GB/month | Limited |
| Cloudflare R2 | 10GB free | Free | 10M Class A, 1M Class B free |

R2 provides:
- No egress fees (major cost savings)
- Global CDN included
- Better performance for static assets
- S3-compatible API

---

## Rollback Plan

If issues arise with R2:

1. Keep Supabase Storage bucket intact during transition
2. Database still has original `thumbnail_url` column
3. Can revert component code to use Supabase URLs
4. R2 data remains available for future migration attempt

---

## Timeline

| Phase | Task | Status |
|-------|------|--------|
| 1 | R2 bucket setup | ✅ Complete |
| 2 | Thumbgen app | ✅ Complete |
| 3 | Bulk thumbnail generation | 🔄 In Progress |
| 4 | Main site integration | ⏳ Pending |
| 5 | Upload flow migration | ⏳ Pending |
| 6 | Supabase cleanup | ⏳ Pending |
