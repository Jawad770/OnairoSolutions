# Production Hardening Report — Onairo Core

**Date:** 30 July 2026  
**Scope:** Portal persistence, public XSS, promotions, AI authz, sandbox publish, campaigns, CSP, tests, docs

## Summary

Onairo Core was hardened for production with database-as-source-of-truth persistence, public HTML sanitization, atomic promotion redemption, AI transcript authorization, public catalog DTO-only responses, campaign auto-apply/targeting/visual improvements, Helmet CSP, disabled Coming Soon modules, and documentation updates for the four-pillar model.

## Fixed vulnerabilities / defects

| Area | Fix |
|---|---|
| CRITICAL persist wipe-rebuild | `saveState` now upserts rows and syncs associations per-parent; never deletes the whole portal database. Test wipe expanded to include catalog/promo/marketing/sandbox tables. |
| Public XSS | Shared sanitizers (`server/shared/sanitize.js`, `src/shared/js/sanitize.js`); campaign banners built with DOM/`textContent`; product cards use DOM APIs. |
| Promotion race | Redeem runs in one transaction with `FOR UPDATE` lock; re-checks status/dates/maxUses inside the lock. |
| Promotion security | Client `amount` and `leadId` ignored; server resolves plan price and lead from email/WhatsApp. |
| AI transcript IDOR | Staff AI routes require Super Admin, `ai.view`, `leads.view_all`, or ownership of the assigned lead. |
| Public catalog leakage | Removed `raw` Prisma graphs; item endpoints return `toPublicItemDto` only. |
| Auto-apply campaigns | Public DTO exposes `campaignId`/`promotionId`; apply API accepts `promotionId`. |
| Timezone | Campaign schedule parsing uses IANA timezone → UTC helpers (`server/shared/timezone.js`). |
| Sandbox publish | Existing plans sync features; new plans create features; removed plans archived. |
| Placeholder modules | Clients/Projects/EduTrack/Newsletter/Analytics/Downloads/Licenses show Coming Soon and are non-navigable. |
| CSP | Helmet CSP re-enabled with documented allow-list (self, Google Fonts, YouTube frames, https images). |
| Catalog promo/pricing HTML | Escape/DOM for promotion results; escape `plan.subtitle` in pricing cards; stop sending client `amount`. |
| Tests | Default `npm test` runs with `--test-concurrency=1`; wipe covers promotion/catalog/sandbox tables. |

## Remaining risks

| Risk | Severity | Notes |
|---|---|---|
| In-memory portal cache can go stale across multiple Node processes | Medium | Writes are DB-safe upserts, but reads still use process memory. Prefer sticky sessions or a follow-up read-through cache. |
| CSP still allows `'unsafe-inline'` scripts/styles | Medium | Required for existing portal/public inline scripts. Migrate to nonces next. |
| Sandbox does not yet isolate full website sections / AI knowledge / landing HTML | Medium | Catalog (+ overlays) and campaigns path improved; full site-state sandbox remains partial. |
| True per-test PostgreSQL schemas for parallel isolation | Medium | Sequential tests are the default; parallel isolation via ephemeral schemas is the next step. |
| Default admin password fallback if env unset | Low | Ensure production `INIT_ADMIN_*` is always set. |
| Quote upload MIME allow-list | Low | Frontend accept hints only; add server MIME allow-list next. |

## Test results

| Suite | Result | Notes |
|---|---|---|
| `npm run ai:build` | PASS | AI routes compiled after authz hardening |
| Authorization + promotions (sequential) | **46/46 PASS** | Includes previously failing promo race/duplicate-code cases |
| `npm run verify:portal` | PASS (prior audit) | Public + portal smoke checks |
| Full suite | Run `npm test` | Default is now sequential (`--test-concurrency=1`) |

Recommended verification commands after deploy:

```bash
npm run ai:build
npm test
npm run verify:portal
```

## Security checklist

- [x] No production wipe-and-rebuild persist
- [x] Escape/validate public campaign and product rendering
- [x] Atomic promotion redeem with row lock
- [x] Ignore client price / leadId on redeem
- [x] AI staff APIs permission-gated
- [x] Public catalog DTOs only (no Prisma `raw`)
- [x] Helmet CSP enabled
- [x] Coming Soon modules not clickable as enabled features
- [ ] Nonce-based CSP (remove unsafe-inline)
- [ ] Multi-instance cache invalidation / read-through DB
- [ ] Full sandbox website-state isolation
- [ ] Per-test ephemeral DB schemas for parallel CI

## Performance metrics

Not measured in this pass (no Lighthouse/mobile lab run in this session). Recommend:

- Lighthouse mobile/desktop on homepage, EduTrack, portfolio demo
- p95 for `/api/catalog/items` and `/api/marketing/campaigns/active`
- Confirm CSP does not block fonts or AI SSE

## Deployment readiness score

**78 / 100 — Conditional go**

Safe to deploy behind a single Node instance with env secrets set, after running `npm run ai:build`, `npm test`, and `npm run verify:portal`.

Blockers for a full 90+ score: multi-instance memory cache strategy, CSP nonces, complete sandbox site-state coverage, and a clean green sequential test suite on the hardened code.

## CSP exceptions (documented)

| Directive | Allowed | Why |
|---|---|---|
| `script-src` | `'self' 'unsafe-inline'` | Portal HTML embeds inline JS; public chrome hydration |
| `style-src` | `'self' 'unsafe-inline' fonts.googleapis.com` | Inline styles + Google Fonts CSS |
| `font-src` | `'self' fonts.gstatic.com data:` | Google Fonts |
| `img-src` | `'self' data: blob: https:` | Portfolio/Unsplash/CDN imagery |
| `frame-src` | `'self' youtube.com` | Embedded demos/videos if present |
| `connect-src` | `'self'` | Same-origin APIs / AI SSE |

## Files touched (high level)

- `server/db/store.js` — upsert persist + expanded test wipe
- `server/db/repositories/promotions.js` — locked redeem, ignore client amount/leadId
- `server/db/repositories/sandbox.js` — feature sync on publish
- `server/db/repositories/marketingCampaigns.js` — audience filter
- `server/catalogPublic.js` — DTO-only public responses
- `server/marketingPublic.js` — auto-apply DTO fields
- `server/portalMarketing.js` — timezone-aware schedule parsing
- `server/ai/src/routes/index.ts` — transcript authorization
- `server/main.js` — CSP + Coming Soon module handling
- `server/permissions.js` / `authz.js` / `portalViews.js` — Coming Soon nav
- `server/shared/sanitize.js`, `server/shared/timezone.js`
- `src/shared/js/sanitize.js`, `campaign-client.js`, `main.js`, `chrome.js`
- `README.md`, `package.json`, `server/ai/knowledge/faqs.json`
- `PRODUCTION_HARDENING_REPORT.md` (this file)
