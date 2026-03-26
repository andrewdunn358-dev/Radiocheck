# Radio Check — Product Requirements Document

## Original Problem Statement
Build a veteran support platform (Radio Check) with AI-powered chat companions, peer support, and comprehensive resource pages. The app has an Expo React Native frontend, Next.js admin portal, and FastAPI backend.

## Current Phase: CMS Phase 2 — Block-Based Content Management

### Core Architecture
- **Frontend**: Expo React Native (mobile app)
- **Admin Portal**: Next.js (admin dashboard)
- **Backend**: FastAPI + MongoDB
- **CMS**: Block-Based system — pages stored as typed `blocks` arrays
- **Block Types**: `chat_banner`, `heading`, `paragraph`, `callout`, `bullet_list`, `support_card`, `image`, `crisis_footer`, `divider`

### Key Components
- `CMSBlockRenderer.tsx` — Native mobile block renderer (with icon support on callouts)
- `VisualPageEditor.tsx` — WordPress-style inline editor matching app's dark navy theme
- `useCMSBlocks.ts` — React hook for fetching CMS blocks by slug
- `cms_content.py` — Backend CMS CRUD + batch seed endpoint

### CMS Pages (16 total, all published)
| Slug | Title | Persona | Blocks |
|------|-------|---------|--------|
| about | About Radio Check | tommy | 19 |
| for-carers | For Carers | helen | 24 |
| criminal-justice | Criminal Justice Support | doris | 16 |
| crisis-support | Crisis Support | tommy | 14 |
| he-served | He Served | dave | 29 |
| historical-investigations | Warfare on Lawfare | james | 14 |
| compensation-schemes | Compensation Schemes | jack | 19 |
| serious-illness | Serious Illness Support | reg | 27 |
| recovery-support | Recovery Support | mo | 25 |
| privacy-policy | Privacy Policy | — | 25 |
| terms-of-service | Terms of Service | — | 19 |
| commonwealth-veterans | Commonwealth Comrades | kofi | 23 |
| faith-service | Faith & Service | catherine | 20 |
| substance-support | Substance Support | sam | 18 |
| women-veterans | She Served Too | rita | 18 |
| money-benefits | Money & Benefits | jack | 18 |

### Pages NOT Migrated (Interactive/API-dependent)
- `associations.tsx` — 90+ entries with search/filter/grouping
- `regimental-associations.tsx` — Interactive search/filter
- `forces-kids.tsx` — Interactive filtering
- `they-served.tsx` — Interactive filtering
- `organizations.tsx` — Fetches from API
- `recommended-reads.tsx` — Fetches from API + OpenLibrary
- `resources.tsx` — Fetches from API
- `family-friends.tsx` — Complex forms
- `peer-support.tsx` — Complex API interactions
- `your-data-rights.tsx` — Complex forms
- `self-care.tsx` — Interactive tools grid with fallback data
- `home.tsx` — System/functional page

### Visual Editor Features
- Dark navy theme matching mobile app (#1a2332 background, #2d3748 cards)
- Icon picker for callout blocks (28 Lucide icons, 12 colors)
- Inline text editing with contenteditable
- Chat banner persona picker
- Image upload
- Support card tag selector
- Block reordering (up/down arrows)
- Block add/delete

## What's Been Implemented
- [x] Block-Based CMS schema and CRUD APIs
- [x] CMSBlockRenderer for native mobile rendering
- [x] VisualPageEditor with dark navy theme
- [x] Icon support on callout blocks (editor + mobile)
- [x] Bulk page seed script and batch-seed endpoint
- [x] 16 pages migrated to CMS (all published)
- [x] All .tsx files updated to use CMSBlockRenderer
- [x] Fixed infinite 404 loop on home.tsx, self-care.tsx
- [x] Removed rogue CMS hooks from non-CMS pages (self-care, family-friends)
- [x] Fixed all persona avatar paths in PERSONA_DATA (jack, kofi, sam, james, baz, alex)
- [x] Copied missing avatar images to public/images/
- [x] Fixed 10 incorrect persona assignments in CMS database
- [x] Full audit: no non-CMS pages have CMS hooks

## 3rd Party Integrations
- OpenAI GPT-4o-mini (Emergent LLM Key)
- Agora Video SDK (User API Key)

## Key API Endpoints
- `GET /api/cms/pages/{slug}` — Public page fetch
- `GET /api/cms/admin/pages` — Admin list all pages
- `PUT /api/cms/admin/pages/{slug}` — Update page blocks
- `POST /api/cms/admin/pages` — Create new page
- `POST /api/cms/admin/pages/batch-seed` — Bulk seed pages
- `GET /api/cms/personas` — List AI personas
- `POST /api/cms/admin/image/upload` — CMS image upload

## Backlog
### P1 — Upcoming
- Enhance Video UX: TikTok Live-like experience with chat overlay and floating reactions

### P2 — Future
- Push notifications for live events
- PDF user manual export
- Discussion Forums
- Mood Tracker
- Welsh Language Support
- Agora to Daily.co migration consideration
- Migrate remaining interactive pages to CMS (would require new block types for search/filter)
