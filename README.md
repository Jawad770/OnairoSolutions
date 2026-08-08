# Onairo Solutions — Technology Company Website

Premium website for **Onairo Solutions** — a technology company with four business pillars:

1. **Build (Services)** — software engineering, websites, automation, and AI for clients  
2. **Launch (Industry websites)** — industry-specific demo websites and launches  
3. **Scale (Products)** — commercial software (EduTrack, FitTrack, and the Track suite)  
4. **Sell (Shopify)** — Shopify store design, launch, and conversion optimisation

## Architecture
```
onairo-solutions/
├── public/                    ← Production document root (only this is served statically)
│   ├── demos/                 ← Canonical showcase demos → /showcase/<name>
│   ├── images/
│   └── …
├── server/                    ← Express portal (never exposed as static files)
├── src/                       ← Dev sources / generators (not served)
└── …
```

## Navigation

Home · Services · Portfolio · Products · About · Pricing · Blog · Contact · Request Quote

## Demo websites (showcase)

Canonical files: `public/demos/<name>.html`  
Public URLs: `/showcase/<name>` (e.g. `/showcase/carshowroom`)

Relative assets such as `demo-globals.js` resolve under `/showcase/…`.

Legacy redirects:
- `/demo/<name>` → `/showcase/<name>`
- `/src/portfolio/demos/<name>.html` → `/showcase/<name>`

## Deployment

Pure static site — no build step.

Upload the project root to Netlify, Vercel, GitHub Pages, or cPanel.

## WhatsApp

Update in one place: `src/shared/js/config.js` → `waNumber`.

Demo sites still use their local `WA_NUMBER` constants (unchanged).

## SEO

Technical SEO is handled by:

- `robots.txt` (blocks `/portal`, `/api`, private assets)
- `sitemap.xml` (pages, portfolio SEO pages, blog articles)
- `src/shared/js/seo-data.js` + `src/shared/js/seo.js` (titles, meta, Open Graph, Twitter, JSON-LD)
- Indexable portfolio SEO pages under `src/portfolio/*-website-design.html`
- Blog system under `src/pages/blog/` with category filters

Regenerate portfolio/blog SEO pages and sitemap:

```bash
npm run seo:generate
```

Configure in `src/shared/js/config.js`:

- `siteUrl`
- `gscVerification` (Google Search Console)
- `gaMeasurementId` (optional GA4)

## Backup

A full pre-restructure backup was created at:

`C:\Users\pc\onairo-solutions-backup\onairo-solutions-full-backup-20260727-231549`

## Internal Portal (Private CRM)

A secure internal portal is now included for Onairo operations:

- Private route: `/portal` (configurable via `PORTAL_ROUTE`)
- Auth required before any portal page is accessible
- Form submissions from `Contact` and `Request Quote` are stored as leads
- Dashboard, CRM table, lead details, Kanban pipeline, and export (CSV/XLSX/PDF)

### Security controls implemented

- Password hashing with `bcryptjs`
- Session cookies (`httpOnly`, `sameSite`, `secure` in production)
- CSRF protection (`csrf-sync`)
- Rate limiting for login and form endpoints
- Login attempt tracking + automatic lockout
- Session timeout + remember-me extension
- Audit logging and noindex headers for portal pages

### Run locally

```bash
npm install
npm run start
```

Then open:

- Public site: `http://localhost:3000`
- Portal login: `http://localhost:3000/portal`

Default bootstrap admin (change immediately):

- Email: `admin@onairosolutions.com`
- Password: `ChangeMeNow!123`

Override with environment variables before first run:

- `INIT_ADMIN_EMAIL`
- `INIT_ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PORTAL_ROUTE`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Onairo AI (Phase 1)

Modular AI business consultant on the public site (floating widget) with:

- Behaviour / knowledge / tools / memory / provider layers under `server/ai/`
- Streaming chat API (`/api/ai/*`)
- CRM lead capture (`source_type: onairo_ai`) + transcript on lead detail
- Anonymous conversation retention (configurable; permanent when converted to a lead)
- Provider abstraction — switch LLMs without changing the rest of the app

### Provider switch

Default provider is **Google Gemini**. Keep OpenAI available for fallback:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
```

To use OpenAI instead:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
```

Setup:

1. Ensure PostgreSQL has the `ai` schema (`scripts/db/init-schemas.sql` or `CREATE SCHEMA IF NOT EXISTS ai;`)
2. `npx prisma db push` and `npx prisma generate`
3. Set `GEMINI_API_KEY` (or `OPENAI_API_KEY` if using OpenAI) in `.env` — see `.env.example`
4. Optional: `npm run ai:build` to compile TypeScript to `server/ai/dist/` (tsx loads source as fallback)

If the active provider’s API key is missing, the app starts normally and `/api/ai/status` reports unavailable.

```bash
npm test
```
