# KiCad Subcircuit Sharing Platform - Planning Documentation

This directory contains comprehensive planning documentation for building an open-source platform where users can share and discover reusable KiCad schematic subcircuits.

## Overview

The platform enables KiCad users to:
- **Copy** schematic subcircuits from KiCad (Ctrl+C)
- **Upload** to a web-based library with searchable metadata
- **Discover** circuits through search, tags, and filters
- **Copy** back to clipboard with one click
- **Paste** directly into their own KiCad projects (Ctrl+V)

All with proper licensing, attribution, and interactive previews.

## Planning Documents

### 1. [Technical Architecture](./technical-architecture.md)
**Key Topics:**
- System architecture (Next.js + PostgreSQL + KiCanvas)
- Technology stack decisions (Node.js vs Python, why PostgreSQL)
- API design (REST endpoints)
- Deployment strategies (Vercel recommended for MVP)
- Performance optimization (caching, indexing, CDN)
- Security considerations

**TL;DR**: Next.js frontend with KiCanvas renderer, Node.js/Express backend, PostgreSQL with JSONB for S-expression storage, GitHub OAuth, deployed on Vercel.

---

### 2. [File Format Analysis](./file-format-analysis.md)
**Key Topics:**
- KiCad S-expression format deep dive
- Clipboard copy/paste mechanism (text-based!)
- What's included: symbols, wires, labels, **footprints**
- What's NOT included: PCB layout (separate file)
- Parsing strategy and existing libraries
- Metadata extraction requirements

**Key Discovery**: KiCad 6+ embeds all symbol definitions in schematics, making them self-contained and perfect for sharing. When you copy in KiCad, raw S-expression text goes to clipboard.

---

### 3. [Data Model](./data-model.md)
**Key Topics:**
- Complete PostgreSQL schema (users, subcircuits, favorites, copy_events, etc.)
- JSONB storage strategy for S-expressions and metadata
- Full-text search implementation (tsvector, GIN indexes)
- ORM choice (Prisma recommended)
- Example queries for search, discovery, analytics
- Performance optimization with indexes

**Key Tables**: `users`, `subcircuits` (with JSONB columns), `favorites`, `copy_events`, `collections` (phase 2)

---

### 4. [Legal & Licensing](./legal-and-licensing.md)
**Key Topics:**
- Open source hardware licenses (CERN-OHL-S recommended)
- OSHWA compliance requirements
- Attribution mechanisms (auto-embed in S-expression)
- Platform Terms of Service
- GDPR compliance (data export, right to erasure)
- Content moderation policy
- Patent and trademark considerations
- Warranty disclaimers

**Recommended Licenses to Support**: CERN-OHL-S, MIT, CC-BY-SA, GPL-3, TAPR-OHL, CC-BY, Apache-2.0

---

### 5. [User Experience](./user-experience.md)
**Key Topics:**
- User personas (hobbyist, professional, student, OSH designer)
- Core user journeys (discover, upload, copy)
- UI/UX mockups (homepage, search, detail page, upload flow)
- Key UX patterns (instant preview, one-click copy, trust signals)
- Performance targets (<1s page load)
- Accessibility (WCAG 2.1 AA)
- Mobile responsiveness

**Core Workflow**: Search → Preview (interactive KiCanvas) → Copy (one click) → Paste in KiCad

---

### 6. [Competitive Analysis](./competitive-analysis.md)
**Key Topics:**
- Existing platforms (SnapEDA, Ultra Librarian, GitHub, KiCad libraries)
- Market gaps we fill (subcircuit focus, copy/paste workflow, discoverability)
- Competitive advantages (KiCad-native, open source, niche focus)
- Potential partnerships (KiCad, OSHWA, Hackaday)
- Monetization strategies (donations, affiliates, premium features)
- SWOT analysis
- Go-to-market strategy

**Key Insight**: No existing platform focuses on **reusable schematic subcircuits** for KiCad with a streamlined copy/paste workflow. We fill the gap between component libraries (SnapEDA) and full projects (GitHub).

---

## Quick Reference

### Tech Stack Summary
- **Frontend**: Next.js 14, React, Tailwind CSS, KiCanvas (WebGL viewer)
- **Backend**: Node.js, Express/Fastify, TypeScript
- **Database**: PostgreSQL 15+ with JSONB
- **Auth**: GitHub OAuth (NextAuth.js)
- **Hosting**: Vercel (frontend + serverless functions) + Neon/Railway (PostgreSQL)
- **Search**: PostgreSQL full-text search with GIN indexes

### MVP Features (Must-Have)
1. GitHub OAuth sign-in
2. Upload subcircuit (paste S-expression)
3. Parse and validate KiCad format
4. Extract metadata (components, nets, bounding box)
5. Interactive schematic preview (KiCanvas)
6. Search (full-text + component + tag filtering)
7. One-click copy to clipboard
8. License selection (8 options)
9. Auto-generated attribution
10. User profiles
11. Favorite button

### Phase 2 Features (Nice-to-Have)
- Collections (organize favorites)
- Comments and discussions
- Version history
- Fork/remix circuits
- Advanced analytics
- API for third-party integrations
- Multi-language support

### Success Metrics (6 months)
- 500+ users
- 200+ subcircuits
- 1,000+ copies performed
- 5,000+ monthly visitors
- Positive community feedback

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL | JSONB for S-expressions, excellent FTS, mature |
| **Frontend Framework** | Next.js | SSR/SSG for SEO, API routes, React ecosystem |
| **Rendering** | KiCanvas | MIT licensed, WebGL, supports KiCad 6+ |
| **Authentication** | GitHub OAuth | Natural fit for developer community |
| **License Default** | CERN-OHL-S-2.0 | Hardware-specific, copyleft, OSHWA-approved |
| **Platform License** | MIT | Encourage contributions, allow forks |
| **Hosting** | Vercel + Neon | Fast deployment, serverless, generous free tier |

## Legal & Compliance Checklist

- [ ] Write Terms of Service (upload agreement, user responsibilities)
- [ ] Write Privacy Policy (GDPR-compliant)
- [ ] Implement DMCA takedown process
- [ ] Add warranty disclaimer ("AS IS")
- [ ] Add liability limitation
- [ ] Require license selection on upload
- [ ] Auto-embed attribution in S-expressions
- [ ] User data export feature (GDPR)
- [ ] Account deletion feature (GDPR)
- [ ] Content reporting system
- [ ] Choose platform name (avoid "KiCad" trademark conflict)

## Development Roadmap

### Month 1: Foundation
- [ ] Set up Next.js project with TypeScript
- [ ] Configure PostgreSQL (local + Neon)
- [ ] Implement GitHub OAuth
- [ ] Design database schema (Prisma)
- [ ] Build S-expression parser
- [ ] Set up basic UI (Tailwind + shadcn/ui)

### Month 2: Core Features
- [ ] Upload flow (paste → parse → preview → publish)
- [ ] Detail page with KiCanvas viewer
- [ ] Copy to clipboard functionality
- [ ] Search implementation (PostgreSQL FTS)
- [ ] User profiles
- [ ] Favorite system

### Month 3: Polish & Launch
- [ ] Responsive design (mobile)
- [ ] SEO optimization
- [ ] Performance tuning
- [ ] Write documentation
- [ ] Seed with 50 high-quality circuits
- [ ] Launch on Hacker News, Reddit, KiCad forums

### Month 4-6: Growth
- [ ] Community feedback integration
- [ ] Bug fixes and UX improvements
- [ ] Marketing (Hackaday article, KiCad partnership)
- [ ] Analytics and metrics tracking
- [ ] Consider monetization options

## Research Sources

All planning documents are based on research from:
- **KiCad Developer Documentation**: https://dev-docs.kicad.org/
- **OSHWA**: https://www.oshwa.org/
- **KiCanvas**: https://github.com/theacodes/kicanvas
- **Competitive platforms**: SnapEDA, Ultra Librarian, GitHub, etc.
- **Web search**: Latest best practices for PostgreSQL, Next.js, licensing

## Next Steps

1. **Review all planning documents** to ensure alignment
2. **Set up development environment** (Node, PostgreSQL, Git)
3. **Initialize Next.js project** with TypeScript
4. **Create Prisma schema** based on data-model.md
5. **Build S-expression parser** (start simple, iterate)
6. **Integrate KiCanvas** for preview rendering
7. **Start with MVP features** (upload + search + copy)

## Questions to Resolve

1. **Platform name**: Need to choose (avoid "KiCad" trademark)
   - Suggestions: Circuit Snippets, Schematic Share, SubCircuit Hub, OpenCircuits
2. **Hosting budget**: How much can we spend initially?
   - Free tier: Vercel (free) + Neon free tier (500MB)
   - Paid: $20-50/month if we exceed free limits
3. **Content moderation**: Manual review or automated? (Start manual for MVP)
4. **Initial circuit seeding**: Who creates the first 50 circuits?
   - Option: Convert examples from KiCad documentation
   - Option: Extract from open source projects with permission

## Contact & Collaboration

This is an open planning process. If you'd like to contribute or provide feedback:
- Create GitHub issues for suggestions
- Fork and improve planning docs
- Join discussions on implementation approach

---

**Version**: 1.0 (Planning Phase)
**Last Updated**: January 2025
**Status**: Ready for development

Let's build something awesome for the KiCad community! 🚀
