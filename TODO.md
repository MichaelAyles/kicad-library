# CircuitSnips - Development TODO List

**Last Updated**: 2025-10-17
**Status**: 40% Complete - Frontend Shell Ready, Backend Not Connected

---

## 🎯 Critical Path to MVP

### Phase 1: Backend Decision & Cleanup (Day 1)

- [ ] **Choose Database System**
  - [x] Supabase configured and environment variables set
  - [ ] **DECISION NEEDED**: Commit to Supabase (recommended) OR switch to Prisma
  - [ ] If Supabase: Delete Prisma files
  - [ ] If Prisma: Delete Supabase files

- [ ] **Clean Up Prisma (if using Supabase)**
  - [ ] Delete `prisma/` folder
  - [ ] Delete `src/lib/db.ts`
  - [ ] Remove `@prisma/client` from `package.json`
  - [ ] Remove Prisma scripts from `package.json`
  - [ ] Run `npm install` to update lockfile

- [ ] **Initialize Supabase Database**
  - [ ] Open Supabase SQL Editor
  - [ ] Run `supabase/schema.sql` script
  - [ ] Verify tables created: `profiles`, `circuits`, `circuit_components`, `favorites`, `circuit_copies`
  - [ ] Verify storage bucket `circuits` exists
  - [ ] Test connection from Next.js app

---

## Phase 2: Dark Mode (Quick Win - Day 1)

- [ ] **Install Dependencies**
  - [ ] `npm install next-themes`

- [ ] **Create Theme Provider**
  - [ ] Create `src/components/ThemeProvider.tsx`
  - [ ] Wrap app in provider in `src/app/layout.tsx`
  - [ ] Add `suppressHydrationWarning` to `<html>` tag

- [ ] **Create Theme Toggle Component**
  - [ ] Create `src/components/ThemeToggle.tsx`
  - [ ] Add sun/moon icons (from lucide-react)
  - [ ] Toggle between light/dark/system

- [ ] **Add Toggle to UI**
  - [ ] Add to header navigation (all pages)
  - [ ] Position near "Sign In" button
  - [ ] Test theme switching works
  - [ ] Verify persistence across page reloads

- [ ] **Fix Hard-Coded Colors**
  - [ ] Remove `className="bg-white"` from headers
  - [ ] Use `bg-background` instead
  - [ ] Test all pages in dark mode
  - [ ] Fix any contrast issues

---

## Phase 3: Authentication System (Days 2-3)

### 3.1 Supabase Auth Configuration

- [ ] **Enable Auth Providers in Supabase Dashboard**
  - [ ] Enable Email/Password auth
  - [ ] Configure GitHub OAuth (recommended)
    - [ ] Create GitHub OAuth App
    - [ ] Set callback URL: `https://[your-project].supabase.co/auth/v1/callback`
    - [ ] Add Client ID and Secret to Supabase
  - [ ] (Optional) Configure Google OAuth

- [ ] **Customize Email Templates**
  - [ ] Update confirmation email template
  - [ ] Update password reset template
  - [ ] Add CircuitSnips branding

### 3.2 Auth UI Components

- [ ] **Create Auth Pages**
  - [ ] `src/app/login/page.tsx` - Sign in form
  - [ ] `src/app/signup/page.tsx` - Registration form
  - [ ] `src/app/auth/callback/route.ts` - OAuth callback handler
  - [ ] `src/app/forgot-password/page.tsx` - Password reset request
  - [ ] `src/app/reset-password/page.tsx` - New password form

- [ ] **Create Auth Components**
  - [ ] `src/components/auth/LoginForm.tsx`
  - [ ] `src/components/auth/SignUpForm.tsx`
  - [ ] `src/components/auth/OAuthButtons.tsx` (GitHub/Google)
  - [ ] `src/components/auth/PasswordResetForm.tsx`

- [ ] **Create Auth Hooks**
  - [ ] `src/hooks/useUser.ts` - Get current user
  - [ ] `src/hooks/useAuth.ts` - Auth methods (signIn, signOut, signUp)

### 3.3 Update Navigation

- [ ] **Update Header Component**
  - [ ] Create `src/components/Header.tsx` (shared component)
  - [ ] Show "Sign In" when logged out
  - [ ] Show user avatar/menu when logged in
  - [ ] Add dropdown menu with:
    - [ ] Profile
    - [ ] My Circuits
    - [ ] Favorites
    - [ ] Settings
    - [ ] Sign Out

- [ ] **Replace Header Across All Pages**
  - [ ] `src/app/page.tsx` (home)
  - [ ] `src/app/browse/page.tsx`
  - [ ] `src/app/upload/page.tsx`
  - [ ] `src/app/search/page.tsx`
  - [ ] `src/app/circuit/[slug]/page.tsx`

### 3.4 Protected Routes

- [ ] **Implement Route Protection**
  - [ ] Update `src/middleware.ts` to check auth
  - [ ] Redirect to `/login` if not authenticated for protected routes
  - [ ] Protect `/upload` route
  - [ ] Protect `/settings` route (to be created)
  - [ ] Protect `/profile/edit` route (to be created)

- [ ] **Server-Side Auth Checks**
  - [ ] Add auth checks to Server Components
  - [ ] Add auth checks to API routes
  - [ ] Handle unauthorized access gracefully

---

## Phase 4: Database Integration (Days 4-5)

### 4.1 User Profile Management

- [ ] **Profile Creation on Signup**
  - [ ] Verify trigger `handle_new_user()` is working
  - [ ] Test profile auto-creation on registration
  - [ ] Handle username generation/uniqueness

- [ ] **User Profile Page**
  - [ ] Create `src/app/user/[username]/page.tsx`
  - [ ] Display user info (avatar, bio, website, GitHub)
  - [ ] List user's circuits
  - [ ] Show stats (circuits uploaded, total copies received)
  - [ ] Add "Edit Profile" button (if own profile)

- [ ] **Profile Edit Page**
  - [ ] Create `src/app/profile/edit/page.tsx`
  - [ ] Form fields: username, bio, website, GitHub URL
  - [ ] Avatar upload to Supabase Storage
  - [ ] Update profile API endpoint
  - [ ] Validation and error handling

### 4.2 Circuit Upload Flow

- [ ] **Update Upload Page**
  - [ ] Require authentication (redirect if not logged in)
  - [ ] Create Server Action: `src/app/upload/actions.ts`
  - [ ] Parse S-expression and extract metadata
  - [ ] Generate unique slug
  - [ ] Upload to `circuits` table
  - [ ] Extract and store components in `circuit_components` table
  - [ ] Upload raw `.kicad_sch` file to Supabase Storage
  - [ ] Redirect to circuit detail page on success

- [ ] **Storage Integration**
  - [ ] Configure storage path: `circuits/{user_id}/{slug}.kicad_sch`
  - [ ] Set public read, authenticated write policies
  - [ ] Handle file size limits (1MB recommended)
  - [ ] Error handling for upload failures

### 4.3 Browse Page (Database-Driven)

- [ ] **Replace Mock Data**
  - [ ] Query circuits from Supabase: `SELECT * FROM circuits WHERE is_public = true`
  - [ ] Join with profiles for user info
  - [ ] Order by `copy_count DESC` (most copied)
  - [ ] Implement pagination (12 per page)

- [ ] **Filters and Sorting**
  - [ ] Sort by: Most Copied, Recent, Favorites
  - [ ] Filter by category
  - [ ] Filter by license
  - [ ] Filter by tags (array overlap query)

- [ ] **Search Bar**
  - [ ] Redirect to `/search?q=...` on submit
  - [ ] Show search results inline (optional)

### 4.4 Circuit Detail Page

- [ ] **Load from Database**
  - [ ] Query circuit by slug
  - [ ] Load full S-expression from storage
  - [ ] Load components from `circuit_components` table
  - [ ] Show 404 if circuit not found or private

- [ ] **View Tracking**
  - [ ] Call `increment_circuit_views()` function on page load
  - [ ] Update view count in UI

- [ ] **Copy Tracking**
  - [ ] Create API route: `src/app/api/circuits/[id]/copy/route.ts`
  - [ ] Insert into `circuit_copies` table
  - [ ] Track user ID (if logged in), IP, user agent
  - [ ] Increment `copy_count` on `circuits` table

- [ ] **Download Feature**
  - [ ] Serve file from Supabase Storage
  - [ ] Add attribution metadata to download
  - [ ] Track download events (optional)

### 4.5 Favorites System

- [ ] **Favorite Button**
  - [ ] Check if user has favorited (query `favorites` table)
  - [ ] Create API route: `src/app/api/circuits/[id]/favorite/route.ts`
  - [ ] POST to add favorite
  - [ ] DELETE to remove favorite
  - [ ] Update `favorite_count` on circuits table
  - [ ] Require authentication

- [ ] **User Favorites Page**
  - [ ] Create `src/app/favorites/page.tsx`
  - [ ] Query user's favorited circuits
  - [ ] Display as grid (like browse page)
  - [ ] Add unfavorite button

---

## Phase 5: Search Functionality (Days 6-7)

### 5.1 Full-Text Search

- [ ] **Implement Search Page**
  - [ ] Update `src/app/search/page.tsx`
  - [ ] Read query param: `?q=search+term`
  - [ ] Use Supabase full-text search: `to_tsquery()`
  - [ ] Query `search_vector` column with `@@` operator
  - [ ] Rank results by `ts_rank()`

- [ ] **Search Features**
  - [ ] Search across: title, description, tags
  - [ ] Highlight search terms in results
  - [ ] Show "No results found" message
  - [ ] Suggest popular tags if no results

### 5.2 Advanced Filters

- [ ] **Component Search**
  - [ ] Search by component name (e.g., "LM358")
  - [ ] Query JSONB `metadata` column
  - [ ] Use `@>` containment operator

- [ ] **Tag Filtering**
  - [ ] Multi-select tag filter UI
  - [ ] Query with array overlap: `tags && ARRAY['tag1', 'tag2']`

- [ ] **Category Filter**
  - [ ] Dropdown for categories
  - [ ] Filter query by category

- [ ] **License Filter**
  - [ ] Checkbox list of licenses
  - [ ] Filter by selected licenses

---

## Phase 6: User Settings (Day 8)

- [ ] **Create Settings Page**
  - [ ] Create `src/app/settings/page.tsx`
  - [ ] Tabs: Profile, Account, Notifications, Privacy

- [ ] **Profile Settings**
  - [ ] Edit username, bio, website, GitHub
  - [ ] Avatar upload/change
  - [ ] Social links

- [ ] **Account Settings**
  - [ ] Change email
  - [ ] Change password
  - [ ] Connected accounts (GitHub, Google)
  - [ ] Delete account (with confirmation)

- [ ] **Notification Settings**
  - [ ] Email notifications toggle
  - [ ] Notification preferences (favorites, comments, etc.)

- [ ] **Privacy Settings**
  - [ ] Public/private profile toggle
  - [ ] Show/hide email
  - [ ] Show/hide statistics

---

## Phase 7: Polish & UX Improvements (Day 9)

### 7.1 Error Handling

- [ ] **Create Error Components**
  - [ ] `src/app/error.tsx` - Global error boundary
  - [ ] `src/app/not-found.tsx` - Custom 404 page
  - [ ] Toast notifications for errors (e.g., react-hot-toast)

- [ ] **Handle API Errors**
  - [ ] Network errors
  - [ ] Database errors
  - [ ] Auth errors
  - [ ] File upload errors

### 7.2 Loading States

- [ ] **Skeleton Screens**
  - [ ] Browse page loading skeleton
  - [ ] Circuit detail loading skeleton
  - [ ] Profile page loading skeleton

- [ ] **Loading Spinners**
  - [ ] Upload form submission
  - [ ] Search results
  - [ ] Infinite scroll loading

### 7.3 Empty States

- [ ] **No Results Messages**
  - [ ] Empty browse page (no circuits)
  - [ ] No search results
  - [ ] No favorites
  - [ ] No user circuits

- [ ] **Call-to-Action**
  - [ ] "Upload your first circuit" message
  - [ ] "Sign in to favorite circuits"
  - [ ] "Search for circuits to get started"

### 7.4 SEO & Metadata

- [ ] **Dynamic Metadata**
  - [ ] Circuit detail: title, description, OG image
  - [ ] User profile: title, description
  - [ ] Search results: dynamic title

- [ ] **Sitemap**
  - [ ] Generate `sitemap.xml`
  - [ ] Include all public circuits
  - [ ] Update on new uploads

- [ ] **Robots.txt**
  - [ ] Allow crawling of public pages
  - [ ] Disallow crawling of auth pages

---

## Phase 8: Analytics & Tracking (Day 10)

- [ ] **Copy Event Tracking**
  - [ ] Log all copy events to `circuit_copies` table
  - [ ] Track: timestamp, user_id, IP, user agent
  - [ ] Dashboard showing most copied circuits

- [ ] **View Tracking**
  - [ ] Increment view count on circuit detail page
  - [ ] Avoid counting same user multiple times (optional)

- [ ] **User Analytics Dashboard**
  - [ ] Create `src/app/dashboard/page.tsx`
  - [ ] Show user's circuit performance
  - [ ] Total views, copies, favorites
  - [ ] Most popular circuits
  - [ ] Charts/graphs (optional)

---

## Phase 9: Testing & Quality (Day 11)

### 9.1 Manual Testing

- [ ] **Test User Flows**
  - [ ] Sign up → verify email → login
  - [ ] Upload circuit → view detail → copy
  - [ ] Search → filter → view result
  - [ ] Favorite → view favorites → unfavorite
  - [ ] Edit profile → save → verify changes

- [ ] **Test Error Cases**
  - [ ] Invalid S-expression upload
  - [ ] Duplicate slug handling
  - [ ] Auth token expiration
  - [ ] Network failures
  - [ ] Invalid URLs

- [ ] **Cross-Browser Testing**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

- [ ] **Mobile Responsiveness**
  - [ ] Test on iPhone (Safari)
  - [ ] Test on Android (Chrome)
  - [ ] Test tablet sizes
  - [ ] Fix any layout issues

### 9.2 Performance Testing

- [ ] **Lighthouse Audit**
  - [ ] Homepage: aim for 90+ score
  - [ ] Circuit detail: aim for 85+ score
  - [ ] Optimize images
  - [ ] Minimize JavaScript

- [ ] **Database Query Optimization**
  - [ ] Add indexes (already in schema.sql)
  - [ ] Test query performance with 100+ circuits
  - [ ] Optimize joins

- [ ] **Caching**
  - [ ] Enable Next.js static generation where possible
  - [ ] Cache circuit detail pages (ISR)
  - [ ] Cache API responses

---

## Phase 10: Deployment & Production (Day 12)

### 10.1 Pre-Deployment Checklist

- [ ] **Environment Variables**
  - [ ] Add all env vars to Vercel dashboard
  - [ ] Verify Supabase URLs are production URLs
  - [ ] Add any API keys

- [ ] **Domain Configuration**
  - [ ] Point `circuitsnips.mikeayles.com` to Vercel
  - [ ] Add domain to Vercel project
  - [ ] Update OAuth callback URLs to production domain
  - [ ] Update hardcoded URLs in code

- [ ] **Security Review**
  - [ ] Ensure RLS policies are enabled
  - [ ] Verify service role key is not exposed
  - [ ] Check CORS settings
  - [ ] Review auth configuration

### 10.2 Database Seeding

- [ ] **Seed Initial Data**
  - [ ] Create admin account
  - [ ] Upload knock sensor example circuit
  - [ ] Upload 5-10 more example circuits
  - [ ] Generate realistic view/copy counts

### 10.3 Monitoring Setup

- [ ] **Error Tracking**
  - [ ] Set up Sentry (optional)
  - [ ] Configure error alerts

- [ ] **Analytics**
  - [ ] Set up Google Analytics or Plausible
  - [ ] Track page views
  - [ ] Track key events (signup, upload, copy)

- [ ] **Uptime Monitoring**
  - [ ] Set up UptimeRobot or similar
  - [ ] Monitor production site
  - [ ] Alert on downtime

### 10.4 Launch

- [ ] **Deploy to Production**
  - [ ] Push to main branch (triggers Vercel deploy)
  - [ ] Verify deployment succeeds
  - [ ] Test production site

- [ ] **Announce Launch**
  - [ ] Post on Hacker News
  - [ ] Post on Reddit (r/KiCad, r/electronics)
  - [ ] Share on Twitter/LinkedIn
  - [ ] Update README with live URL

---

## 🚀 Future Enhancements (Post-MVP)

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

## 🐛 Known Issues to Fix

- [ ] **Dead Links**
  - [ ] `/api/auth/signin` → 404 (needs to be `/login`)
  - [ ] `/user/{username}` → 404 (not implemented)
  - [ ] `/about` → 404 (needs placeholder page)
  - [ ] `/docs` → 404 (needs documentation)

- [ ] **Non-Functional Features**
  - [ ] Upload form submits to console only
  - [ ] Favorite button only toggles local state
  - [ ] "Load More" button does nothing
  - [ ] Search filters don't work
  - [ ] Sort buttons don't change order

- [ ] **UI Issues**
  - [ ] Hard-coded `bg-white` on headers (breaks dark mode)
  - [ ] No loading states on async operations
  - [ ] No error messages for failed operations

- [ ] **Code Quality**
  - [ ] Remove unused imports
  - [ ] Add TypeScript strict mode
  - [ ] Fix any ESLint warnings
  - [ ] Add JSDoc comments to functions

---

## 📝 Documentation Tasks

- [ ] **Update README.md**
  - [ ] Add live demo link
  - [ ] Add screenshots
  - [ ] Update feature list
  - [ ] Add contribution guidelines

- [ ] **Create CONTRIBUTING.md**
  - [ ] How to set up dev environment
  - [ ] Code style guide
  - [ ] Pull request process

- [ ] **API Documentation**
  - [ ] Document API endpoints
  - [ ] Request/response examples
  - [ ] Error codes

- [ ] **User Guide**
  - [ ] How to upload circuits
  - [ ] How to search effectively
  - [ ] How to cite/attribute circuits

---

## 🧪 Testing Tasks (Optional but Recommended)

- [ ] **Unit Tests**
  - [ ] Test S-expression parser
  - [ ] Test metadata extraction
  - [ ] Test validation functions
  - [ ] Test utility functions

- [ ] **Integration Tests**
  - [ ] Test auth flow
  - [ ] Test circuit upload
  - [ ] Test search functionality

- [ ] **E2E Tests (Playwright)**
  - [ ] Test complete user journey
  - [ ] Test edge cases
  - [ ] Test error scenarios

---

## 📊 Progress Tracking

**Overall MVP Completion: 40%**

- ✅ Frontend UI/UX: 90% complete
- ✅ Parser Logic: 100% complete
- ⏳ Backend Setup: 50% complete (Supabase configured but not used)
- ❌ Authentication: 0% complete
- ❌ Database Integration: 0% complete
- ❌ Search: 0% complete
- ⏳ Dark Mode: 80% complete (CSS ready, needs toggle)
- ❌ User Features: 0% complete

---

## 🎯 This Week's Priority

**Focus on getting to 80% MVP:**

1. **Monday**: Clean up Prisma, add dark mode, run Supabase schema
2. **Tuesday**: Implement authentication (login, signup, OAuth)
3. **Wednesday**: Connect database queries (browse, upload, detail)
4. **Thursday**: Implement favorites and tracking
5. **Friday**: Add search functionality
6. **Weekend**: Testing and polish

**Goal**: Have a functioning app by end of week!

---

## Notes

- Prioritize features that provide immediate value to users
- Test each feature before moving to the next
- Commit frequently with descriptive messages
- Deploy to production early and often
- Gather feedback from early users

**Remember**: Ship early, iterate fast. Don't wait for perfection!
