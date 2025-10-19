# CircuitSnips

> Copy-paste schematic circuits for KiCad

An open-source platform for sharing and discovering reusable KiCad schematic subcircuits. Built by makers, for makers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What is CircuitSnips?

CircuitSnips fills the gap between component libraries and full project repositories. We focus on **reusable subcircuits** - functional circuit blocks like voltage regulators, amplifiers, and sensor interfaces that you can instantly copy and paste into your KiCad projects.

### The Problem
- Redrawing common circuits from scratch is tedious
- Component libraries (SnapEDA, Ultra Librarian) only provide individual symbols
- GitHub projects require downloading and extracting entire repos
- Hard to discover well-designed circuit patterns

### The Solution
1. **Copy** a circuit from KiCad (Ctrl+C)
2. **Upload** to CircuitSnips with description and license
3. **Others search** and find your circuit
4. **One-click copy** to clipboard
5. **Paste** directly into KiCad (Ctrl+V)

All in under 10 seconds!

## ✨ Features

### MVP (Current Development)
- 🔍 **Full-text search** with component and tag filtering
- 👁️ **Interactive preview** using KiCanvas (WebGL rendering)
- 📋 **One-click copy** to clipboard with embedded attribution
- 🔐 **GitHub OAuth** authentication
- ⚖️ **License clarity** - 8 open source hardware licenses supported
- 📦 **Metadata extraction** - automatic component lists, net names, statistics
- ⭐ **Favorites** and social features
- 🏷️ **Smart tagging** with autocomplete

### Planned (Phase 2)
- 📚 Collections (organize circuits into groups)
- 💬 Comments and discussions
- 🔄 Version history and forking
- 🌐 Multi-language support
- 📱 Mobile app
- 🔌 API for third-party integrations

## 🏗️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS + shadcn/ui
- **Rendering**: [KiCanvas](https://github.com/theacodes/kicanvas) (MIT licensed WebGL viewer)
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL 15+ with JSONB)
- **Search**: PostgreSQL full-text search with GIN indexes
- **Authentication**: GitHub OAuth via Supabase Auth
- **Storage**: Supabase Storage for S-expressions
- **Hosting**: Vercel (frontend + API)
- **Domain**: circuitsnips.mikeayles.com (MVP), circuitsnips.io (production)

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm/yarn/pnpm
- PostgreSQL 15+ (or use Docker)
- Git
- KiCad 6+ (for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/circuitsnips.git
cd circuitsnips

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials and GitHub OAuth keys

# Run development server
npm run dev
```

Visit http://localhost:3000

### Environment Variables

Create `.env.local`:

```env
# Supabase (create account at https://supabase.com)
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

# GitHub OAuth (create at https://github.com/settings/developers)
# Configured in Supabase Authentication → Providers → GitHub
GITHUB_ID="your_github_client_id"
GITHUB_SECRET="your_github_client_secret"
```

### Database Setup

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key to `.env.local`
3. Run the complete schema in Supabase SQL Editor:

```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste contents of: supabase/complete-schema.sql
# Then click "Run"
```

This will create:
- All database tables (profiles, circuits, favorites, etc.)
- Storage buckets (`circuits` and `thumbnails`)
- Row Level Security (RLS) policies
- Helper functions and triggers

The schema is **idempotent** - safe to run multiple times.

## 📖 Documentation

Comprehensive planning documentation is available in [.claude/](.claude/):

- [Technical Architecture](.claude/technical-architecture.md) - System design, tech choices
- [File Format Analysis](.claude/file-format-analysis.md) - KiCad S-expression deep dive
- [Data Model](.claude/data-model.md) - Database schema and queries
- [Legal & Licensing](.claude/legal-and-licensing.md) - OSHWA compliance, licenses
- [User Experience](.claude/user-experience.md) - UX patterns and mockups
- [Competitive Analysis](.claude/competitive-analysis.md) - Market positioning

## 🤝 Contributing

We welcome contributions! Whether you're:
- 🐛 Fixing bugs
- ✨ Adding features
- 📝 Improving documentation
- 🎨 Designing UI/UX
- 🧪 Writing tests
- 🌐 Translating to other languages

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with conventional commits (`feat: add circuit preview zoom`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- TypeScript for all code
- ESLint + Prettier for formatting
- Conventional Commits for commit messages
- Write tests for new features

## 📋 Project Status

**Current Phase**: MVP Development (Advanced Stage) - Core functionality complete!

### Completed ✅
- [x] Planning and research complete
- [x] Project setup and documentation
- [x] Database schema implementation with migrations (Supabase)
- [x] GitHub OAuth integration
- [x] Dark mode support with theme switching
- [x] **S-expression parser with clipboard snippet detection**
- [x] **KiCanvas interactive preview integration**
- [x] **Complete upload flow with 4 steps:**
  - [x] Paste & validate schematic
  - [x] Interactive KiCanvas preview
  - [x] Metadata entry (title, description, tags, license)
  - [x] Automatic thumbnail capture (light & dark modes)
- [x] **Circuit detail page with KiCanvas viewer**
- [x] **One-click copy to clipboard with attribution**
- [x] Browse page with database queries
- [x] Authentication pages (login/signup)
- [x] User profile page with avatar support
- [x] Responsive design (mobile & desktop)
- [x] **Live deployment**: https://circuitsnips.mikeayles.com

### In Progress 🔄
- [ ] Search implementation (full-text search with PostgreSQL)
- [ ] Favorites functionality (backend ready, UI pending)
- [ ] Copy tracking analytics

### Planned 📋
- [ ] User settings page
- [ ] Circuit editing/versioning
- [ ] Collections feature
- [ ] Comments and discussions
- [ ] SEO optimization
- [ ] API documentation

### Design Variants 🎨
Experimental design branches available for review:
- `design/hyper-modern` - Glassmorphism, neon accents, ultra-minimal
- `design/classic` - Serif typography, navy palette, traditional layout
- `design/wild` - Neon brutalism, asymmetric, cyberpunk aesthetic

See [Design Variants Documentation](DESIGN_VARIANTS.md) for previews and details.

See [TODO.md](TODO.md) for detailed task breakdown.

## 🎓 Learning Resources

New to KiCad or open source hardware?

- [KiCad Documentation](https://docs.kicad.org/)
- [KiCad Developer Docs](https://dev-docs.kicad.org/)
- [OSHWA Guidelines](https://www.oshwa.org/definition/)
- [S-Expression Format](https://dev-docs.kicad.org/en/file-formats/sexpr-intro/)

## 📜 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

### Circuit Licenses

Circuits uploaded to CircuitSnips can use any of these open source hardware licenses:
- CERN-OHL-S-2.0 (recommended)
- MIT
- CC-BY-4.0
- CC-BY-SA-4.0
- GPL-3.0
- Apache-2.0
- TAPR-OHL-1.0
- BSD-2-Clause

Each circuit clearly displays its license for users to understand usage rights.

## 🙏 Acknowledgments

- [KiCad](https://www.kicad.org/) - Amazing open source EDA tool
- [KiCanvas](https://github.com/theacodes/kicanvas) - WebGL schematic viewer
- [OSHWA](https://www.oshwa.org/) - Open source hardware advocacy
- The entire open source hardware community

## 📞 Contact

- **Website**: https://circuitsnips.mikeayles.com
- **Issues**: [GitHub Issues](https://github.com/yourusername/circuitsnips/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/circuitsnips/discussions)
- **Email**: hello@circuitsnips.io (coming soon)

## 🗺️ Roadmap

### Phase 1: MVP Launch (Current - 90% Complete) ✅
- [x] Core upload functionality with KiCanvas preview
- [x] GitHub OAuth authentication
- [x] Dark mode support
- [x] Circuit detail pages with copy-to-clipboard
- [x] Browse page functionality
- [x] Live deployment to circuitsnips.mikeayles.com
- [ ] Favorites system
- [ ] Full-text search

### Phase 2: Core Features (Q1 2025)
- [ ] Search implementation with filters
- [ ] User settings page
- [ ] 50+ seed circuits
- [ ] SEO optimization
- [ ] Analytics dashboard

### Phase 3: Community Growth (Q2 2025)
- [ ] Comments and discussions
- [ ] Collections (organize circuits)
- [ ] Circuit forking and versioning
- [ ] Email notifications
- [ ] Mobile app optimization

### Phase 4: Scale & Advanced Features (Q3-Q4 2025)
- [ ] Public API v1
- [ ] KiCad plugin for direct integration
- [ ] Multi-language support
- [ ] Premium features (private circuits, teams)
- [ ] Custom domain (circuitsnips.io)

---

**Built with ❤️ by the open source hardware community**

[⭐ Star this project](https://github.com/yourusername/circuitsnips) if you find it useful!
