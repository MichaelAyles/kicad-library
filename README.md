# CircuitSnips

Share and discover reusable KiCad circuits.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is this?

CircuitSnips lets you share schematic blocks - think voltage regulators, amplifiers, sensor interfaces - stuff you'd normally copy between your own projects. Now you can find what others have built and share what you've made.

Copy circuit in KiCad → Paste on CircuitSnips → Someone else searches → Copies to their project. That's it.

## Current features

- Interactive preview using KiCanvas
- Copy to clipboard with attribution
- GitHub login
- 8 open hardware licenses
- Comments with threading
- Light/dark mode with thumbnails for both
- User profiles
- Circuit editing (title, description, tags, license, visibility)
- Delete your account and data

## Still working on

- Search (database is ready, just need the UI)
- Favorites (mostly done, needs hookup)
- Analytics for copy tracking

## Tech

Next.js 14, TypeScript, Tailwind, Supabase (PostgreSQL + auth + storage), KiCanvas for rendering. Hosted on Vercel.

## Running locally

```bash
git clone https://github.com/yourusername/circuitsnips.git
cd circuitsnips
npm install
cp .env.example .env.local
# Add your Supabase URL and keys to .env.local
npm run dev
```

Database setup: Create a Supabase project, then run `supabase/schema.sql` in the SQL editor. It's safe to run multiple times.

## Contributing

Fork it, make your changes, send a PR. Use conventional commits if you can.

Before committing:
- `npm run build` should pass
- `npm run lint` should pass

## Licenses

Platform code: MIT

Uploaded circuits: Users pick from CERN-OHL-S-2.0, MIT, CC-BY-4.0, CC-BY-SA-4.0, GPL-3.0, Apache-2.0, TAPR-OHL-1.0, or BSD-2-Clause

## Credits

- KiCad for existing
- KiCanvas for the WebGL viewer
- Everyone who shares their circuits

## Links

Live site: https://circuitsnips.mikeayles.com

Report bugs in GitHub Issues.
