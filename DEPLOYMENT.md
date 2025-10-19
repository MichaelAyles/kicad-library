# CircuitSnips Deployment Guide

**Last Updated**: 2025-10-18
**Target Domain**: circuitsnips.mikeayles.com

---

## Pre-Deployment Checklist

### ✅ Completed
- [x] Database schema created in Supabase
- [x] GitHub OAuth configured
- [x] Environment variables defined
- [x] Upload flow implemented and tested
- [x] Authentication working
- [x] Dark mode functional

### 🔨 TODO Before Deploy

1. **Run Complete Schema in Supabase** (CRITICAL)
   ```sql
   -- In Supabase Dashboard → SQL Editor
   -- Copy and paste: supabase/complete-schema.sql
   -- Click "Run"
   ```
   This creates the `thumbnails` storage bucket and applies all migrations.

2. **Verify Storage Buckets**
   - Go to Supabase Dashboard → Storage
   - Verify buckets exist:
     - ✅ `circuits` (you already have this)
     - ⚠️ `thumbnails` (will be created by running complete-schema.sql)

3. **Test Build Locally** (if possible) or in Vercel Preview
   ```bash
   npm run build
   ```
   Fix any TypeScript or build errors.

4. **Seed Database** (Optional but recommended)
   - Upload 1-2 example circuits via the upload flow
   - OR run a seed script (to be created)

---

## Vercel Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Select the repository: `kicad-library` (or whatever your repo name is)

### 2. Configure Project Settings

**Framework Preset**: Next.js
**Root Directory**: `./` (project root)
**Build Command**: `npm run build` (default)
**Output Directory**: `.next` (default)
**Install Command**: `npm install` (default)

### 3. Add Environment Variables

In Vercel Project Settings → Environment Variables, add:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Where to find these:**
- Supabase Dashboard → Settings → API
- Copy "Project URL" and "anon public" key

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Vercel will assign a temporary URL: `your-project.vercel.app`

### 5. Configure Custom Domain

1. In Vercel Project Settings → Domains
2. Add domain: `circuitsnips.mikeayles.com`
3. Follow Vercel's instructions to update DNS records
4. Wait for SSL certificate to provision (~5 minutes)

### 6. Update OAuth Callback URLs

After deploying, update GitHub OAuth settings:

1. Go to [GitHub OAuth Apps](https://github.com/settings/developers)
2. Select your CircuitSnips OAuth App
3. Update **Authorization callback URL**:
   ```
   https://[your-supabase-project].supabase.co/auth/v1/callback
   ```
   (This should already be correct if you set it up in Supabase)

4. In Supabase Dashboard → Authentication → URL Configuration:
   - **Site URL**: `https://circuitsnips.mikeayles.com`
   - **Redirect URLs**: Add `https://circuitsnips.mikeayles.com/**`

---

## Post-Deployment Verification

### Test These User Flows:

1. **Authentication**
   - [ ] Visit site and click "Sign In"
   - [ ] GitHub OAuth redirects correctly
   - [ ] User is logged in after callback
   - [ ] Username displays in header

2. **Upload Circuit**
   - [ ] Go to `/upload`
   - [ ] Paste a KiCad S-expression (use clipboard.txt for testing)
   - [ ] Verify preview loads
   - [ ] Fill metadata form
   - [ ] Capture thumbnails
   - [ ] Upload succeeds
   - [ ] Redirects to circuit detail page

3. **Browse Page**
   - [ ] Visit `/browse`
   - [ ] Circuits load from database
   - [ ] Thumbnails display (after thumbnails bucket is created)
   - [ ] Sort buttons work (Most Copied, Recent, Favorites)

4. **Dark Mode**
   - [ ] Toggle dark mode in header
   - [ ] Theme persists on page reload
   - [ ] All pages look correct in dark mode

---

## Known Issues (To Fix Before Launch)

### Critical
- [ ] Circuit detail page not implemented (redirects will fail)
- [ ] Browse page missing thumbnail images
- [ ] No copy-to-clipboard functionality yet

### Nice to Have
- [ ] Add error boundaries for better error handling
- [ ] Add loading skeletons
- [ ] Add toast notifications for user feedback

---

## Rollback Plan

If deployment fails or has critical bugs:

1. **Quick Fix**: Revert to previous deployment in Vercel
   - Vercel Dashboard → Deployments
   - Click "..." on previous deployment
   - Click "Promote to Production"

2. **Database Rollback**: Not needed (schema is additive, no destructive changes)

3. **Emergency**: Change DNS to maintenance page if needed

---

## Monitoring & Logs

### Vercel Logs
- Real-time logs: Vercel Dashboard → Deployments → [Current] → Runtime Logs
- Build logs: Vercel Dashboard → Deployments → [Current] → Build Logs

### Supabase Logs
- Database logs: Supabase Dashboard → Logs
- Auth logs: Supabase Dashboard → Authentication → Logs

### Error Tracking (Future)
- Consider adding Sentry for production error tracking

---

## Performance Optimization (Post-Launch)

### Immediate
- [ ] Enable Vercel Analytics
- [ ] Check Lighthouse scores
- [ ] Optimize images if needed

### Future
- [ ] Add CDN for static assets
- [ ] Implement ISR (Incremental Static Regeneration) for circuit detail pages
- [ ] Add caching headers
- [ ] Optimize KiCanvas loading (lazy load)

---

## Support & Troubleshooting

### Common Issues

**1. "Auth callback URL mismatch"**
- Check Supabase → Authentication → URL Configuration
- Verify GitHub OAuth callback URL matches

**2. "Failed to upload thumbnails"**
- Verify `thumbnails` storage bucket exists
- Check RLS policies on storage.objects table
- Run `complete-schema.sql` if not already done

**3. "Circuits not loading on browse page"**
- Check Supabase connection (verify env vars)
- Check browser console for errors
- Verify RLS policies allow public reads

**4. Build fails on Vercel**
- Check TypeScript errors: `npm run build` locally
- Check dependency issues: `npm install`
- Review Vercel build logs for specific errors

### Getting Help

- Check TODO.md for known issues
- Review recent git commits for context
- Check Supabase logs for database errors
- Check Vercel runtime logs for API errors

---

## Next Steps After MVP Launch

1. Monitor usage and errors
2. Gather user feedback
3. Fix critical bugs
4. Complete remaining MVP features:
   - Circuit detail page
   - Browse thumbnails
   - Favorites system
5. Add analytics (Plausible or Google Analytics)
6. Create 50+ seed circuits
7. Announce on Reddit, Hacker News, KiCad forums

---

**Ready to deploy?** Run through the checklist above, then push to main to trigger Vercel deployment! 🚀
