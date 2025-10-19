# CircuitSnips - Development TODO List

**Last Updated**: 2025-10-18
**Status**: 70% Complete - Upload Flow Working, Browse & Detail Pages Needed

---

## 🎯 Critical Path to MVP

### ✅ Phase 1: Backend Setup (COMPLETED)

- [x] **Supabase Database**
  - [x] Supabase configured and environment variables set
  - [x] Schema deployed (`supabase/schema.sql`)
  - [x] Migration for `is_public`, `thumbnail_light_url`, `thumbnail_dark_url` applied
  - [x] Tables created: `profiles`, `circuits`, `favorites`, `circuit_copies`
  - [x] Storage buckets: `thumbnails` configured
  - [x] RLS policies configured for public/private circuits

---

### ✅ Phase 2: Dark Mode (COMPLETED)

- [x] **Dark Mode Implementation**
  - [x] `next-themes` installed
  - [x] Theme provider implemented in layout
  - [x] Theme toggle component created
  - [x] Dark mode working across all pages
  - [x] KiCanvas viewer syncs with theme

---

### ✅ Phase 3: Authentication System (COMPLETED)

- [x] **GitHub OAuth**
  - [x] GitHub OAuth configured in Supabase
  - [x] Auth callback route: `src/app/auth/callback/route.ts`
  - [x] Login page: `src/app/login/page.tsx`
  - [x] Signup page: `src/app/signup/page.tsx`
  - [x] Auth hook: `src/hooks/useAuth.ts` (signInWithGitHub, signOut)
  - [x] Protected routes (upload page redirects to login)

- [x] **Header Component**
  - [x] `src/components/Header.tsx` created
  - [x] Shows "Sign In" when logged out
  - [x] Shows user info when logged in
  - [x] Used across all pages

---

### ✅ Phase 4: Upload Flow (COMPLETED - needs testing)

- [x] **Circuit Upload Implementation**
  - [x] Upload page with 5-step wizard (paste → preview → metadata → thumbnails → upload)
  - [x] S-expression parser: `src/lib/kicad-parser.ts`
    - [x] Validates KiCad format
    - [x] Handles both snippets and full files
    - [x] Extracts metadata (components, stats, footprints)
    - [x] Auto-suggests tags and category
  - [x] KiCanvas interactive preview
  - [x] Preview API: `src/app/api/preview/route.ts` (stores schematics in memory cache)
  - [x] Thumbnail generation: `src/lib/thumbnail.ts`
    - [x] Captures both light and dark mode thumbnails using html2canvas
    - [x] Uploads to Supabase Storage (`thumbnails` bucket)
  - [x] Database insert with all metadata
  - [x] Redirects to circuit detail page on success

**Recent Fixes (commits a32fb4f - 864b88a):**
- [x] Fixed KiCanvas file type detection (.kicad_sch extension in URL)
- [x] Fixed viewer remounting with unique React keys
- [x] Added is_public and thumbnail columns to schema

**🚧 KNOWN ISSUES TO TEST:**
- [ ] Verify thumbnails upload correctly to Supabase Storage
- [ ] Test if KiCanvas viewer renders consistently on step 4 (thumbnail capture)
- [ ] Verify redirect to circuit detail page works (needs detail page implementation)
- [ ] Test with both snippet and full file uploads

---

### 🔨 Phase 5: Browse & Detail Pages (IN PROGRESS - HIGH PRIORITY)

**Current State:**
- Browse page exists with UI but needs database integration
- Circuit helper functions exist in `src/lib/circuits.ts`
- Detail page template exists but not connected to database

#### 5.1 Browse Page (Database Integration)

- [x] **Query Functions Created** (`src/lib/circuits.ts:174`)
  - [x] `getCircuits()` - fetches with sorting
  - [x] `searchCircuits()` - text search
  - [x] Functions join with `profiles` table for user info

- [ ] **Browse Page Completion** (`src/app/browse/page.tsx:11`)
  - [x] Replace mock data with `getCircuits()`
  - [x] Sort by: Most Copied, Recent, Favorites (working)
  - [ ] **MISSING**: Display thumbnail images (currently no thumbnails shown)
  - [ ] **MISSING**: Handle loading states properly
  - [ ] **MISSING**: Implement pagination/"Load More" button
  - [ ] **MISSING**: Search bar functionality
  - [ ] **MISSING**: Filter UI (category, license, tags)

#### 5.2 Circuit Detail Page

- [ ] **Load Circuit Data** (`src/app/circuit/[slug]/page.tsx`)
  - [ ] Use `getCircuitBySlug(slug)` from `src/lib/circuits.ts`
  - [ ] Display circuit info (title, description, user, stats)
  - [ ] Show KiCanvas interactive viewer (reuse upload preview logic)
  - [ ] Handle 404 for missing/private circuits

- [ ] **View Tracking**
  - [x] `incrementViewCount()` function exists
  - [ ] Call on page load (useEffect)

- [ ] **Copy to Clipboard**
  - [ ] "Copy Circuit" button
  - [ ] Copies `raw_sexpr` to clipboard
  - [ ] Shows success toast
  - [ ] Calls `incrementCopyCount()` after successful copy

- [ ] **Download Feature**
  - [ ] "Download .kicad_sch" button
  - [ ] Generate file with attribution in comments
  - [ ] Track download event (optional)

#### 5.3 Favorites System

- [ ] **Favorite Button Component**
  - [ ] Create `src/components/FavoriteButton.tsx`
  - [ ] Check if user favorited (query on mount)
  - [ ] Toggle favorite/unfavorite
  - [ ] Update count optimistically
  - [ ] Require authentication (show login prompt if not authenticated)

- [ ] **Favorite API Routes**
  - [ ] `POST /api/circuits/[id]/favorite` - add favorite
  - [ ] `DELETE /api/circuits/[id]/favorite` - remove favorite
  - [ ] Update `favorite_count` on circuits table

- [ ] **User Favorites Page**
  - [ ] Create `src/app/favorites/page.tsx`
  - [ ] Query user's favorited circuits
  - [ ] Reuse browse page grid layout
  - [ ] Show empty state if no favorites

---

### Phase 6: Search & User Pages (Lower Priority)

#### 6.1 Search Page

- [x] **Basic Search UI** (`src/app/search/page.tsx` exists)
- [x] **Search Function** (`searchCircuits()` in `src/lib/circuits.ts:102`)
- [ ] **Connect UI to Backend**
  - [ ] Read `?q=` query param
  - [ ] Call `searchCircuits(query)`
  - [ ] Display results in grid
  - [ ] Show empty state for no results

#### 6.2 User Profile Pages

- [ ] **User Profile View** (`src/app/user/[username]/page.tsx`)
  - [ ] Query user by username from `profiles` table
  - [ ] Display avatar, bio, stats
  - [ ] List user's public circuits
  - [ ] Show "Edit Profile" if viewing own profile

- [ ] **Profile Edit Page**
  - [ ] Form for username, bio, website, GitHub
  - [ ] Avatar upload to Supabase Storage
  - [ ] Update `profiles` table
  - [ ] Validation and error handling

---

### Phase 7: User Settings & Polish (Later)

- [ ] Settings page (deferred to post-MVP)
- [ ] Advanced privacy controls (deferred to post-MVP)

---

### Phase 8: Polish & Deployment Prep

#### 8.1 Known Bugs & Missing Features

- [ ] **Browse Page Thumbnails**
  - [ ] Display `thumbnail_light_url` / `thumbnail_dark_url` from database
  - [ ] Theme-aware thumbnail switching
  - [ ] Fallback image if thumbnail missing

- [ ] **Error Handling**
  - [ ] Add error boundaries (`src/app/error.tsx`)
  - [ ] Add 404 page (`src/app/not-found.tsx`)
  - [ ] Toast notifications for user feedback

- [ ] **Loading States**
  - [ ] Better loading UI on browse page
  - [ ] Skeleton screens for circuit cards

#### 8.2 SEO & Metadata (Pre-launch)

- [ ] **Dynamic Metadata**
  - [ ] Circuit detail: proper title, description, OG image
  - [ ] Browse page metadata
  - [ ] Update `layout.tsx` metadata

- [ ] **Sitemap & Robots**
  - [ ] Generate `sitemap.xml`
  - [ ] Create `robots.txt`

#### 8.3 Pre-Deployment Checklist

- [ ] **Environment Variables**
  - [ ] Verify all required env vars in Vercel dashboard:
    - [ ] `NEXT_PUBLIC_SUPABASE_URL`
    - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] Ensure Supabase project is production-ready

- [ ] **Database Validation**
  - [ ] Verify migration `migration-add-is-public.sql` is applied
  - [ ] Check RLS policies are active
  - [ ] Verify storage buckets (`thumbnails`) exist and have correct policies

- [ ] **Build Test**
  - [ ] Run `npm run build` locally (or in Vercel preview)
  - [ ] Fix any TypeScript errors
  - [ ] Fix any build-time errors

- [ ] **Manual Testing**
  - [ ] Test full upload flow end-to-end
  - [ ] Test authentication (GitHub OAuth)
  - [ ] Test browse page loads circuits
  - [ ] Test dark mode works everywhere

---

## Phase 9: Post-MVP Features (Future)

These features are deferred until after MVP launch:

### Features to Add Later

- [ ] **Comments System**
  - [ ] Add comments on circuits
  - [ ] Reply to comments
  - [ ] Notifications for comment replies

- [ ] **Circuit Versioning**
  - [ ] Upload new versions of circuits
  - [ ] Show version history
  - [ ] Allow downloading specific versions

- [ ] **Collections**
  - [ ] Create collections of circuits
  - [ ] Public/private collections
  - [ ] Share collections

- [ ] **Advanced Search**
  - [ ] Search by voltage range
  - [ ] Search by power consumption
  - [ ] Search by component count

- [ ] **Circuit Forking**
  - [ ] Fork existing circuits
  - [ ] Track forks/derivatives
  - [ ] Attribution chain

- [ ] **KiCad Plugin**
  - [ ] Direct upload from KiCad
  - [ ] Browse circuits in KiCad
  - [ ] One-click paste into schematic

- [ ] **API for Developers**
  - [ ] Public REST API
  - [ ] API documentation
  - [ ] Rate limiting

- [ ] **Internationalization**
  - [ ] Multi-language support
  - [ ] Translate UI strings
  - [ ] Support for non-English circuits

- [ ] **Moderation Tools**
  - [ ] Report inappropriate content
  - [ ] Admin dashboard
  - [ ] Flagging system

- [ ] **Email Notifications**
  - [ ] Notify when circuit is copied
  - [ ] Weekly digest of popular circuits
  - [ ] New follower notifications

---

## 📊 Current Status Summary

**Overall MVP Completion: 70%**

### ✅ Completed (Working)
- Frontend UI: All pages built (home, browse, upload, detail, search, login, signup, about, docs)
- Dark mode: Fully functional with theme toggle
- Authentication: GitHub OAuth working
- Database: Supabase configured, schema deployed, RLS policies active
- S-expression Parser: Complete with snippet & full file support
- Upload Flow: 5-step wizard with KiCanvas preview and thumbnail generation
- Browse Page: Database-driven with sorting (needs thumbnail display)

### 🔨 In Progress (High Priority)
- Circuit detail page: Needs database integration
- Browse page: Missing thumbnail images
- Favorites system: Needs implementation
- Copy/download functionality: Needs implementation

### ⏸️ Not Started (Lower Priority)
- User profile pages
- Search functionality (UI exists, needs wiring)
- Settings page
- Analytics dashboard

---

## 🎯 Next Steps to Launch

**Priority order for MVP:**

1. **Circuit Detail Page** - Most critical, allows users to view uploaded circuits
   - Load circuit from database
   - Display KiCanvas viewer
   - Add copy-to-clipboard button
   - Track views

2. **Browse Page Thumbnails** - Makes browse page actually useful
   - Display thumbnail images from Supabase Storage
   - Theme-aware switching

3. **Favorites System** - Core engagement feature
   - Favorite button component
   - API routes
   - Favorites page

4. **Testing & Polish**
   - Test upload flow end-to-end
   - Fix any bugs
   - Add error handling
   - Prepare for Vercel deployment

---

## 📝 Code Quality Notes

**Strengths:**
- Clean component structure
- Good separation of concerns (lib/ for business logic)
- TypeScript types defined properly
- Consistent use of Tailwind CSS
- Good commit messages with conventional commits

**Areas to improve:**
- Some unused imports may exist
- Could add more inline comments for complex logic
- Error boundaries not implemented yet
- No unit tests (acceptable for MVP)

---

## 🚀 Deployment Readiness

**Ready:**
- ✅ Next.js project configured for Vercel
- ✅ Environment variables defined in `.env.example`
- ✅ Supabase backend ready
- ✅ GitHub OAuth configured

**Needs attention before deploy:**
- [x] Apply database migrations (schema is up to date)
- [ ] **RUN THIS**: Execute `supabase/complete-schema.sql` in Supabase SQL Editor
  - This creates the `thumbnails` storage bucket
  - Applies all migrations including `is_public` column
  - Idempotent - safe to run multiple times
- [x] OAuth callback URLs configured
- [ ] Test build succeeds: `npm run build` (or verify in Vercel preview)
- [ ] Seed database with 1-2 example circuits

---

## 💡 Key Insights from Code Review

**Recent Work (Last 5 commits):**
The team has been focused on fixing KiCanvas rendering issues in the upload flow:
- KiCanvas needs `.kicad_sch` extension in URL path for file type detection
- Preview files stored in memory cache with unique IDs
- Thumbnail capture uses html2canvas with theme switching
- Database schema updated for `is_public` and thumbnail columns

**Upload Flow Architecture:**
Very well designed with clear separation:
1. Paste → validate with parser
2. Preview → KiCanvas via preview API (in-memory cache)
3. Metadata → user fills form
4. Thumbnails → html2canvas captures both themes
5. Upload → writes to Supabase (`circuits` table + `thumbnails` storage)

**Potential Issues:**
- KiCanvas viewer may not render consistently on step 4 (mentioned in recent commits)
- Thumbnail capture relies on DOM rendering, could be flaky
- No rollback mechanism if thumbnail upload fails after circuit insert

**Recommendations:**
- Add toast notifications for user feedback (react-hot-toast)
- Consider adding a "Skip thumbnails" option as fallback
- Test with various S-expression formats (snippets, full files, complex circuits)

---

**Last Updated**: 2025-10-18 by Claude Code
**Ready to ship MVP**: After completing circuit detail page + thumbnails in browse page
