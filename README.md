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

The database schema is already initialized in Supabase. Run the migration:

```bash
# Run schema from supabase/schema.sql in your Supabase SQL Editor
# Or use Supabase CLI: supabase db push
```

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

**Current Phase**: MVP Development (Early Stage)

### Completed ✅
- [x] Planning and research complete
- [x] Project setup and documentation
- [x] Database schema implementation (Supabase)
- [x] GitHub OAuth integration
- [x] Dark mode support
- [x] Browse page with real database queries
- [x] Authentication pages (login/signup)

### In Progress 🔄
- [ ] S-expression parser
- [ ] Upload flow
- [ ] Circuit detail page with KiCanvas viewer
- [ ] Copy to clipboard functionality

### Planned 📋
- [ ] Search implementation (full-text search)
- [ ] User profiles
- [ ] Favorites and copy tracking
- [ ] User settings
- [ ] Deployment to circuitsnips.mikeayles.com

See [GitHub Projects](https://github.com/MichaelAyles/kicad-library/projects) for detailed roadmap.

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

### Q1 2025: MVP Launch
- Core upload/download functionality
- Search and discovery
- GitHub authentication
- 50+ seed circuits

### Q2 2025: Community Growth
- User engagement features
- Mobile optimization
- SEO improvements
- Partnership with KiCad project

### Q3 2025: Advanced Features
- Collections
- Comments and discussions
- Version history
- API v1

### Q4 2025: Scale
- Multi-language support
- Advanced analytics
- Premium features (teams, private circuits)
- Custom domain (circuitsnips.io)

---

**Built with ❤️ by the open source hardware community**

[⭐ Star this project](https://github.com/yourusername/circuitsnips) if you find it useful!
