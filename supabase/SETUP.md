# Supabase Setup Guide for CircuitSnips

This guide will walk you through setting up Supabase as the backend for CircuitSnips.

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or sign in (GitHub login recommended)
3. Click **"New Project"**
4. Fill in project details:
   - **Name**: `circuitsnips`
   - **Database Password**: Generate a strong password (save it somewhere safe!)
   - **Region**: Choose closest to your users (e.g., US East)
5. Click **"Create new project"**
6. Wait ~2 minutes for provisioning

## Step 2: Get Your API Credentials

1. In your project dashboard, go to **Settings** (gear icon) → **API**
2. Copy these three values:

```bash
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbG...
service_role key: eyJhbG... (keep this secret!)
```

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Update `.env.local` with your Supabase credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # Optional, for admin operations
```

3. Also add these to **Vercel** (for production):
   - Go to your project in Vercel
   - Settings → Environment Variables
   - Add all three variables above

## Step 4: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL Editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)

This will create:
- ✅ Tables: `profiles`, `circuits`, `circuit_components`, `favorites`, `circuit_copies`
- ✅ Row Level Security (RLS) policies
- ✅ Storage bucket for circuit files
- ✅ Helper functions for search and analytics
- ✅ Indexes for performance
- ✅ Full-text search

## Step 5: Configure Authentication

### Enable Auth Providers

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable the providers you want:

#### GitHub OAuth (Recommended)
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `CircuitSnips`
   - **Homepage URL**: `http://localhost:3000` (dev) or `https://circuitsnips.mikeayles.com` (prod)
   - **Authorization callback URL**: `https://xxxxx.supabase.co/auth/v1/callback`
4. Copy **Client ID** and **Client Secret**
5. In Supabase, paste these into GitHub provider settings
6. Enable the provider

#### Google OAuth (Optional)
1. Follow similar process in [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add to Supabase

#### Email/Password (Always Available)
- No configuration needed, works out of the box

### Configure Email Templates (Optional)
1. Go to **Authentication** → **Email Templates**
2. Customize confirmation and reset password emails with your branding

## Step 6: Configure Storage

The storage bucket (`circuits`) should already be created by the schema.sql script.

Verify it exists:
1. Go to **Storage** in Supabase dashboard
2. You should see a bucket named `circuits`
3. Policies should be set (public read, authenticated write)

File structure will be:
```
circuits/
  ├── {user_id}/
  │   ├── {slug1}.kicad_sch
  │   ├── {slug2}.kicad_sch
  │   └── ...
```

## Step 7: Test the Connection

1. Start your dev server:
```bash
npm run dev
```

2. Check the console for any connection errors
3. The middleware should refresh auth tokens on each request

## Step 8: Seed Initial Data (Optional)

To add the knock sensor example to the database:

1. Create an account (sign up)
2. Use the upload feature to upload the example
3. Or run this SQL manually:

```sql
-- Replace 'your-user-id' with your actual user ID from auth.users
INSERT INTO circuits (
  slug,
  title,
  description,
  user_id,
  file_path,
  raw_sexpr,
  component_count,
  wire_count,
  net_count,
  category,
  tags,
  license
) VALUES (
  'tpic8101-knock-sensor-interface',
  'TPIC8101 Automotive Knock Sensor Interface',
  'Dual-channel knock sensor interface circuit using Texas Instruments TPIC8101DWRG4...',
  'your-user-id',
  'example/knock-sensor.kicad_sch',
  -- Copy raw_sexpr content from example-Knock-Sensor.txt
  '(lib_symbols ...',
  29,
  45,
  35,
  'Sensor Interface',
  ARRAY['automotive', 'sensor', 'knock-sensor', 'TPIC8101', 'analog', 'SPI', 'differential'],
  'CERN-OHL-S-2.0'
);
```

## Troubleshooting

### "Invalid JWT" or Auth Errors
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Ensure middleware is running (check `src/middleware.ts`)
- Clear browser cookies and try again

### Storage Upload Fails
- Check RLS policies on `storage.objects`
- Ensure user is authenticated
- Check file size (max 50MB by default)

### Database Query Fails
- Check RLS policies for the table
- Ensure user has correct permissions
- Check Supabase logs: **Logs** → **Postgres Logs**

### CORS Issues
- Should not happen with Supabase, but if it does:
- Check that `NEXT_PUBLIC_` prefix is used for client-side env vars
- Restart dev server after changing env vars

## Production Checklist

Before deploying:
- [ ] Environment variables added to Vercel
- [ ] OAuth callback URLs updated to production domain
- [ ] Email templates customized
- [ ] Storage bucket policies reviewed
- [ ] RLS policies tested
- [ ] Database indexes created (done by schema.sql)
- [ ] Monitoring enabled in Supabase dashboard

## Database Backup

Supabase automatically backs up your database. To create manual backup:
1. Go to **Database** → **Backups**
2. Click **"Create backup"**

## Monitoring

Monitor your project health:
1. **Dashboard**: Overview of API requests, DB size, storage usage
2. **Logs**: Real-time logs for API, Auth, Database, Storage
3. **Reports**: Analytics on user activity

## Next Steps

- Implement upload functionality (`src/app/upload/actions.ts`)
- Add auth UI components
- Migrate knock sensor data to database
- Test favorite/copy tracking
- Implement search

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
