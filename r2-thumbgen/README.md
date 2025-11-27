# R2 Thumbnail Generator

Standalone Next.js app for regenerating CircuitSnips thumbnails and migrating to Cloudflare R2 storage.

## Purpose

This temporary app is used to:
1. Fetch all circuits from the Supabase database
2. Generate high-quality thumbnails for each circuit
3. Upload thumbnails to Cloudflare R2 storage
4. Verify thumbnail generation before migrating the main site

**Note**: This app will be deleted after the migration is complete.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```bash
# Copy from .env.example
cp .env.example .env.local

# Fill in your Supabase credentials (read-only access)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Fill in your Cloudflare R2 credentials
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=circuitsnips-thumbnails
R2_PUBLIC_URL=https://your-r2-public-url.com
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

## Features

- **Dashboard**: View all circuits grouped by user
- **Statistics**: See thumbnail coverage and missing thumbnails
- **Filters**: Filter by username or show only circuits missing thumbnails
- **Verification**: Check which circuits have existing thumbnails in Supabase storage

## Workflow

1. Review the circuit list to see current thumbnail status
2. Generate thumbnails (feature to be implemented next)
3. Upload to R2 and verify quality
4. Update main site to use R2 URLs
5. Delete this app

## Port

This app runs on port **3001** to avoid conflicts with the main CircuitSnips app (port 3000).
