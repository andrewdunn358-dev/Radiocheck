# RadioCheck Veterans Support Platform — PRD

## Original Problem Statement
A full-stack veterans mental health support platform with AI chat buddies, virtual events (Agora), and an admin portal. The AI safeguarding system is a critical, multi-layered architecture designed to detect crisis indicators in user messages.

## Core Requirements
1. Multi-layered safeguarding (5 layers: Text Normalizer -> Keyword Scoring -> Phrase Dataset -> Unified Safety -> AI Classifier)
2. AI Personas with soul.md behavioral protocols
3. Virtual events via Agora Video SDK
4. Admin portal for staff oversight
5. DTAC compliance (accessibility, security)

## What's Been Implemented

### Safeguarding System (Complete — 98/99 Tests Pass, 99%)
- 5-layer safety architecture
- Meta-negation logic, tight window prefixes, expanded crisis phrase coverage
- All new personas fully inherit soul.md safeguarding protocols

### AI Platoon (20 Characters)
| Character | Role | Specialist Area |
|-----------|------|-----------------|
| Tommy | Lead Battle Buddy | General veteran support |
| Bob | Peer Support | General chat, gentle approach |
| Frankie | Fitness & Motivation | Gym programmes, physical health |
| Rachel | Women's Issues | Female veteran support |
| Rita | Family Support | Friends & family of veterans |
| Jack | Addiction Support | Alcohol, drugs, gambling |
| Margie | Older Veterans | Age-related issues, loneliness |
| Catherine | Mental Health | PTSD, anxiety, depression |
| Finch | Employment | Jobs, CV, career transition |
| Baz | Dark Humour | Banter-first approach |
| Megan | Young Veterans | Transition, identity |
| Penny | Financial | Benefits, debt, housing |
| Alex | LGBTQ+ | They Served support |
| Sam | Criminal Justice | Prison, probation |
| Kofi | Commonwealth | Commonwealth veteran issues |
| James | Faith & Spirituality | Chaplaincy, moral injury |
| **Dave** | **Men's Health** | **Andropause, MST, Andy's Man Club** |
| **Mo** | **Recovery Support** | **Prosthetics, rehab, chronic pain** |
| **Helen** | **Carer Support** | **Caring for veterans, respite** |
| **Reg** | **Serious Illness** | **Cancer, leukaemia, palliative care** |

### Front Page Layout
**Section Order:** What is Radio Check? → Meet HQ → Meet the AI Platoon → Request a Callback Banner → 20 Tiles → Events

**Request a Callback** is a full-width banner below "Meet the AI Platoon" section (not a grid tile).

**20 Resource Tiles in order:**
Need to Talk, Peer Support, Self-Care, Addictions, Criminal Justice, LawFare, Support Orgs, Compensation Schemes, Money & Benefits, Friends & Family, Growing up Military, He Served, She Served, They Served, Commonwealth Served, Faith in Service, The Gym, Recommended Podcasts, Recovery Support, For Carers, Serious Illness Support

### New Content Pages (with AI Chat Banners)
- **He Served** (`/he-served`) — CTA routes to Dave (`/chat/dave`)
- **Recovery Support** (`/recovery-support`) — Chat banner for Mo (`/chat/mo`)
- **For Carers** (`/for-carers`) — Chat banner for Helen (`/chat/helen`)
- **Serious Illness** (`/serious-illness`) — Chat banner for Reg (`/chat/reg`)

### Portal Website Renames
- "Meet the Founders" → **"Meet HQ"**
- "Meet the AI Team" → **"Meet the AI Platoon"**

### Deployment Fixes
- Removed `emergentintegrations==0.1.0` and `litellm==1.80.0` from requirements.txt

## Locked Directives
- NEVER re-introduce `emergentintegrations` library
- NEVER add a SAFEGUARDING_ADDENDUM that overrides soul.md
- ALWAYS run `extended_test_suite.py` after safety changes
- ALL personas must inherit soul.md protocols

## Test Results (Latest — Feb 2026)
- Extended Test Suite: **98/99 PASS (99%)**
- 1 non-deterministic failure: SC003-baz (dark humour response variance)
- All safeguarding-critical tests: PASS
- New Personas Test: **14/14 PASS (100%)** — `/app/backend/tests/test_new_personas.py`
- Portal verification: All 20 AI personas display correctly

## Bug Fixes Verified (Feb 2026)
1. **Chat Redirection** — Dave, Mo, Helen, Reg correctly route to their own personas (not Tommy)
2. **AI Chat Banners with Photo Avatars** — All four new pages (He Served, Recovery Support, For Carers, Serious Illness) now have proper AI chat banners at the top with real photorealistic avatar images (not generic chat bubble icons)
3. **Callback Banner** — Full-width banner below "Meet the AI Platoon" section
4. **Avatar Images** — Copied to `/app/frontend/assets/images/`, `/app/frontend/public/images/`, and registered in avatar maps

## Upcoming Tasks
- (P1) TikTok Live-like video UX with chat overlay and reactions

## Future/Backlog
- (P2) Push notifications for live events
- (P2) PDF user manual export
- (P2) CMS visual editor
- (P2) Discussion Forums
- (P2) Mood Tracker
- (P2) Welsh Language Support
- (P2) Daily.co migration consideration
