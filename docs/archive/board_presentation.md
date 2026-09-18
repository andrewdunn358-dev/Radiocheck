# Radio Check
## Veterans Mental Health & Peer Support Platform
### Board Presentation Document

---

**Prepared for:** Board of Directors  
**Date:** February 2026  
**Version:** 2.6.0  
**Status:** Production - Live

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Overview](#2-platform-overview)
3. [Mobile Application Features](#3-mobile-application-features)
4. [Staff Portal Features](#4-staff-portal-features)
5. [Admin Portal Features](#5-admin-portal-features)
6. [Marketing Website](#6-marketing-website)
7. [Technical Architecture](#7-technical-architecture)
8. [Security & Compliance](#8-security--compliance)
9. [Development Investment Summary](#9-development-investment-summary)
10. [Future Roadmap](#10-future-roadmap)
11. [Appendix](#11-appendix)

---

## 1. Executive Summary

### Mission Statement

**Radio Check** is a comprehensive mental health and peer support platform designed specifically for UK military veterans. The platform provides 24/7 access to AI-powered support companions, peer support networks, crisis resources, and professional counselling services.

### Key Achievements

- **4 interconnected platforms** working seamlessly together
- **7 AI Support Characters** providing 24/7 availability
- **Complete staff management system** with rota and shift swaps
- **Enterprise-grade security** with GDPR/BACP compliance
- **Beta feedback system** for continuous improvement

### Platform Components at a Glance

| Component | Purpose | Users |
|-----------|---------|-------|
| Mobile App | Primary veteran-facing application | Veterans & their families |
| Staff Portal | Peer supporter & counsellor workspace | Support staff |
| Admin Portal | System administration & analytics | Administrators |
| Marketing Website | Public information & downloads | General public |

---

## 2. Platform Overview

### 2.1 Target Audience

**Primary Users:**
- UK military veterans (all branches)
- Serving personnel seeking support
- Family members and loved ones of veterans

**Secondary Users:**
- Peer support volunteers
- Professional counsellors
- Administrative staff

### 2.2 Core Value Proposition

1. **Always Available** - 24/7 AI support when human help isn't accessible
2. **Veteran-Focused** - Language and tone designed for military community
3. **Multi-Channel Support** - AI chat, peer support, professional counselling
4. **Privacy-First** - Secure, confidential, GDPR-compliant

### 2.3 Live URLs

| Platform | URL | Hosting |
|----------|-----|---------|
| Mobile App | app.radiocheck.me | Vercel |
| Staff Portal | staff.radiocheck.me | 20i |
| Admin Portal | admin.radiocheck.me | 20i |
| Backend API | veterans-support-api.onrender.com | Render |

---

## 3. Mobile Application Features

### 3.1 Home Screen & Navigation

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Quick Access Menu | 10 main navigation options with icons | 8 hours |
| Dark/Light Theme | System-wide theme support | 12 hours |
| CMS-Driven Content | Dynamic menu items from admin | 16 hours |
| Responsive Design | Works on mobile, tablet, desktop | 20 hours |

**Subtotal: ~56 hours**

### 3.2 Crisis Support Module

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Emergency Contacts | One-tap access to crisis lines | 4 hours |
| Samaritans Integration | 116 123 direct dial | 2 hours |
| Veterans UK Helpline | 0808 1914 218 integration | 2 hours |
| NHS 111 Access | Non-emergency medical advice | 2 hours |
| 999 Emergency | Immediate emergency access | 2 hours |
| Crisis Detection | AI monitors for distress signals | 24 hours |

**Subtotal: ~36 hours**

### 3.3 AI Support Companions (Battle Buddies)

Radio Check features 7 unique AI characters, each with specialized support capabilities:

| Character | Specialty | Personality | Dev Estimate |
|-----------|-----------|-------------|--------------|
| **Tommy** | General Battle Buddy | Straightforward, squaddie tone, ~35yo male | 16 hours |
| **Doris** | Emotional Support | Nurturing, compassionate, Forces mum energy | 16 hours |
| **Bob** | Para Veteran Peer | Ex-Para, been there done that, banter | 16 hours |
| **Finch** | Military Law | UK legal information, MOD expertise | 20 hours |
| **Margie** | Addiction Support | Alcohol, drugs, gambling specialist | 16 hours |
| **Hugo** | Wellbeing Coach | Wellness guru, mental health habits | 16 hours |
| **Rita** | Family Support | For partners, spouses, loved ones | 16 hours |

**AI Features Include:**
- Safeguarding detection (suicide/self-harm monitoring)
- Crisis escalation protocols
- Conversation session management
- Rate limiting protection
- Geographic/ISP tracking for safety

**Subtotal: ~116 hours**

### 3.4 Peer Support Features

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Talk to a Veteran | Connect with trained supporters | 12 hours |
| Callback Requests | Schedule calls from staff | 16 hours |
| Buddy Finder | Match with compatible peers | 24 hours |
| Live Chat | Real-time text support | 32 hours |
| WebRTC Audio Calls | Peer-to-peer voice calls | 40 hours |

**Subtotal: ~124 hours**

### 3.5 Self-Care Tools

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Mood Journal | Daily emotional tracking | 16 hours |
| Mood Graph | Visualize mood over time | 12 hours |
| Grounding Exercises | 5-4-3-2-1 technique | 8 hours |
| Breathing Exercises | Guided relaxation | 8 hours |
| Wellness Resources | Curated self-help content | 8 hours |

**Subtotal: ~52 hours**

### 3.6 Mental Health Screening

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| PHQ-9 Depression Screen | 9-question validated assessment | 12 hours |
| GAD-7 Anxiety Screen | 7-question validated assessment | 12 hours |
| Score Interpretation | Severity levels explained | 8 hours |
| Share with Counsellor | Results forwarding | 8 hours |
| Staff Notification | High-risk alerts to staff | 8 hours |

**Subtotal: ~48 hours**

### 3.7 Specialized Support Areas

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Historical Investigations | Lawfare support (NI, Gulf, etc.) | 16 hours |
| Criminal Justice | Veterans in/leaving prison | 12 hours |
| Addictions Directory | Alcohol, drugs, gambling resources | 12 hours |
| Family & Friends | Resources for loved ones | 12 hours |
| Regimental Associations | Service-specific organizations | 8 hours |

**Subtotal: ~60 hours**

### 3.8 Additional App Features

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Support Organizations | Directory with contact options | 16 hours |
| Recommended Podcasts | Curated mental health content | 8 hours |
| Settings Page | Theme, notifications, privacy | 12 hours |
| AI Consent Management | GDPR-compliant data controls | 12 hours |
| Safe Navigation | Back button fixes for web | 8 hours |

**Subtotal: ~56 hours**

### Mobile App Total: ~548 hours

---

## 4. Staff Portal Features

### 4.1 Dashboard & Overview

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Live Status Dashboard | Online staff count, metrics | 12 hours |
| Today's Shifts View | Current shift coverage | 8 hours |
| Pending Callbacks | Queue with urgency indicators | 8 hours |
| Quick Statistics | Key metrics at a glance | 8 hours |

**Subtotal: ~36 hours**

### 4.2 Availability Management

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Status Toggle | Available/Busy/Offline switching | 8 hours |
| Shift Calendar | Monthly view with staff names | 24 hours |
| Add Availability | Register for shift slots | 12 hours |
| Shift Creation | Create new shifts with times | 12 hours |
| Auto-refresh | 30-second data refresh | 4 hours |

**Subtotal: ~60 hours**

### 4.3 Shift Swap System

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Swap Requests | Request to swap shifts | 16 hours |
| Approval Workflow | Manager approval process | 12 hours |
| Email Notifications | Automatic swap notifications | 8 hours |
| Cover Requests | Request shift coverage | 12 hours |

**Subtotal: ~48 hours**

### 4.4 Callback Management

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Callback Queue | View pending requests | 12 hours |
| Callback Details | User info, reason, urgency | 8 hours |
| Take Control | Claim a callback | 8 hours |
| Status Updates | Mark contacted/completed | 8 hours |
| Notes System | Add follow-up notes | 12 hours |
| Release Callback | Return to queue if needed | 4 hours |

**Subtotal: ~52 hours**

### 4.5 Communication Tools

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Live Chat Interface | Real-time text support | 24 hours |
| WebRTC Phone | Peer-to-peer voice calls | 40 hours |
| Message History | View past conversations | 12 hours |
| Typing Indicators | Real-time feedback | 4 hours |

**Subtotal: ~80 hours**

### 4.6 Safeguarding Features

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Concern Logging | Report safeguarding issues | 16 hours |
| Alert Dashboard | View active alerts | 12 hours |
| Escalation Protocols | Clear escalation paths | 8 hours |
| Geolocation Tracking | IP-based location for safety | 12 hours |

**Subtotal: ~48 hours**

### Staff Portal Total: ~324 hours

---

## 5. Admin Portal Features

### 5.1 Dashboard & Analytics

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| User Statistics | Total users, active users | 8 hours |
| Staff Overview | Online count, availability | 8 hours |
| Callback Metrics | Pending, completed today | 8 hours |
| System Health | API status, performance | 8 hours |
| Activity Charts | Visual trend data | 16 hours |

**Subtotal: ~48 hours**

### 5.2 User Management

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| User Directory | Searchable user list | 12 hours |
| Role Assignment | Admin, Staff, User roles | 8 hours |
| Account Actions | Enable/disable accounts | 8 hours |
| Password Reset | Admin-initiated resets | 8 hours |
| User Creation | Add new staff accounts | 12 hours |

**Subtotal: ~48 hours**

### 5.3 Staff Management

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Counsellor Management | Full CRUD operations | 24 hours |
| Peer Supporter Management | Full CRUD operations | 24 hours |
| Status Control | Change staff availability | 8 hours |
| Profile Linking | Connect users to profiles | 12 hours |
| Unified Staff View | Single view all staff | 12 hours |

**Subtotal: ~80 hours**

### 5.4 Content Management System (CMS)

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Page Management | Edit all app pages | 24 hours |
| Section Editor | Add/remove/reorder content | 20 hours |
| Card Editor | Icons, colors, descriptions | 16 hours |
| Preview System | Phone mockup preview | 16 hours |
| CMS Seeding | Default content loading | 12 hours |
| Home Page Integration | Dynamic menu from CMS | 20 hours |

**Subtotal: ~108 hours**

### 5.5 Beta Feedback System

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Feature Flag Toggle | Enable/disable beta surveys | 8 hours |
| Pre-Usage Survey | Initial user feedback | 12 hours |
| Post-Usage Survey | Follow-up assessment | 12 hours |
| Survey Statistics | Response counts, NPS | 12 hours |
| Wellbeing Tracking | Pre/post score comparison | 8 hours |
| CSV Export | Download survey data | 8 hours |

**Subtotal: ~60 hours**

### 5.6 Compliance Documentation

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| ROPA Document | Record of Processing Activities | 4 hours |
| GDPR Audit Report | Data protection compliance | 4 hours |
| BACP Compliance | Ethical framework adherence | 4 hours |
| Incident Response Plan | Emergency procedures | 4 hours |
| Security Review Schedule | Regular audit calendar | 4 hours |
| Safeguarding Disclaimer | Child protection policies | 4 hours |
| PDF Download System | Static file hosting | 8 hours |

**Subtotal: ~32 hours**

### 5.7 Logs & Monitoring

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Call Intent Logs | Track all call attempts | 12 hours |
| Chat Room Logs | Live chat history | 12 hours |
| Safeguarding Alerts | Alert history and status | 16 hours |
| Screening Submissions | PHQ-9/GAD-7 results | 12 hours |
| Panic Alert Logs | Emergency alert history | 12 hours |
| CSV Export | Download any log type | 8 hours |

**Subtotal: ~72 hours**

### 5.8 Organization Management

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Organization Directory | Support org database | 16 hours |
| Full CRUD Operations | Add, edit, delete orgs | 12 hours |
| Resource Library | Curated content management | 16 hours |

**Subtotal: ~44 hours**

### Admin Portal Total: ~492 hours

---

## 6. Marketing Website

| Feature | Description | Dev Estimate |
|---------|-------------|--------------|
| Home Page | Mission statement, hero section | 8 hours |
| About Us | Organization background | 4 hours |
| Services Overview | What we offer | 4 hours |
| Get the App | Download links, QR codes | 4 hours |
| Contact Form | Get in touch functionality | 8 hours |
| Terms of Service | Legal terms | 4 hours |
| Privacy Policy | Data handling disclosure | 4 hours |
| Cookie Policy | Tracking disclosure | 4 hours |

### Marketing Website Total: ~40 hours

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React Native (Expo) | Cross-platform: iOS, Android, Web |
| **Backend** | Python FastAPI | High-performance async API |
| **Database** | MongoDB | Flexible document storage |
| **AI Engine** | OpenAI GPT-4 | Intelligent chat companions |
| **Email** | Resend | Transactional email service |
| **Authentication** | JWT Tokens | Secure session management |

### 7.2 Infrastructure

```
                    ┌─────────────────────┐
                    │   Vercel (App)      │
                    │  app.radiocheck.me  │
                    └─────────┬───────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│  20i (Admin)    │    │   Render (API)      │    │  20i (Staff)    │
│ admin.radio...  │───▶│ veterans-support-   │◀───│ staff.radio...  │
└─────────────────┘    │   api.onrender.com  │    └─────────────────┘
                       └─────────┬───────────┘
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │   MongoDB Atlas     │
                       │   (Database)        │
                       └─────────────────────┘
```

### 7.3 Backend Development

| Component | Description | Dev Estimate |
|-----------|-------------|--------------|
| FastAPI Server | Core API framework | 24 hours |
| Authentication System | JWT, password hashing | 32 hours |
| MongoDB Integration | Database connectivity | 16 hours |
| API Router Structure | Organized endpoints | 24 hours |
| Rate Limiting | Bot protection, abuse prevention | 16 hours |
| Session Management | User session handling | 12 hours |
| Email Notifications | Resend integration | 12 hours |
| Encryption Layer | Field-level encryption | 16 hours |
| Safety Monitor | AI safeguarding system | 24 hours |
| Cron Jobs | Shift reminders, data retention | 12 hours |

**Backend Total: ~188 hours**

---

## 8. Security & Compliance

### 8.1 Data Protection (GDPR)

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Consent Management | AI consent modals, cookie banners | Implemented |
| Data Export | User can request data export | Implemented |
| Right to Deletion | Account deletion capability | Implemented |
| Privacy by Design | Encryption, minimal data collection | Implemented |
| Data Minimization | Only essential data stored | Implemented |

### 8.2 Clinical Standards (BACP)

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Ethical Framework | AI prompts follow BACP guidelines | Implemented |
| Safeguarding Protocols | Automatic risk detection | Implemented |
| Confidentiality | Encrypted storage, secure transmission | Implemented |
| Professional Boundaries | AI clearly states limitations | Implemented |
| Crisis Escalation | Automatic alert system | Implemented |

### 8.3 Security Measures

| Measure | Description | Status |
|---------|-------------|--------|
| HTTPS Everywhere | TLS encryption on all endpoints | Implemented |
| JWT Authentication | Secure token-based auth | Implemented |
| Password Hashing | bcrypt with salt | Implemented |
| Session Timeout | 2-hour inactivity logout | Implemented |
| Rate Limiting | IP-based request throttling | Implemented |
| Input Validation | Pydantic models, sanitization | Implemented |
| Field Encryption | Sensitive data encrypted at rest | Implemented |

### Security & Compliance Development: ~48 hours

---

## 9. Development Investment Summary

### 9.1 Development Hours by Component

| Component | Hours | Percentage |
|-----------|-------|------------|
| Mobile Application | 548 | 33% |
| Admin Portal | 492 | 30% |
| Staff Portal | 324 | 20% |
| Backend API | 188 | 11% |
| Security & Compliance | 48 | 3% |
| Marketing Website | 40 | 2% |
| **TOTAL** | **1,640** | **100%** |

### 9.2 Development Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1: Foundation | Week 1-2 | Backend API, authentication, database |
| Phase 2: Core App | Week 2-3 | Mobile app structure, navigation, theming |
| Phase 3: AI Integration | Week 3-4 | AI characters, chat system, safeguarding |
| Phase 4: Staff Systems | Week 4-5 | Staff portal, rota, callbacks |
| Phase 5: Admin Systems | Week 5-6 | Admin portal, CMS, analytics |
| Phase 6: Polish & Testing | Week 6+ | Bug fixes, UX improvements, beta testing |

### 9.3 Equivalent Commercial Value

Based on industry standard development rates:

| Rate Type | Hourly Rate | Total Value |
|-----------|-------------|-------------|
| Junior Developer | £50/hour | £82,000 |
| Mid-level Developer | £80/hour | £131,200 |
| Senior Developer | £120/hour | £196,800 |
| **Blended Rate Estimate** | **£85/hour** | **£139,400** |

**Note:** This represents development value only. Additional costs for:
- UI/UX design
- Project management
- Quality assurance
- Hosting & infrastructure
- Ongoing maintenance

Would typically add 40-60% to total project cost.

---

## 10. Future Roadmap

### 10.1 Phase 2 - Planned Features

| Feature | Description | Priority | Estimate |
|---------|-------------|----------|----------|
| Push Notifications | Appointment reminders, engagement | High | 24 hours |
| Video Call Support | WebRTC video chat | Medium | 40 hours |
| Enhanced Mood Tracking | Trend analysis, filtering | Medium | 20 hours |
| Welsh Language | Full Welsh translation | Medium | 40 hours |
| CBT Courses | Structured therapy modules | Medium | 60 hours |

### 10.2 Phase 3 - Future Features

| Feature | Description | Priority | Estimate |
|---------|-------------|----------|----------|
| App Store Release | Native iOS/Android deployment | High | 40 hours |
| Offline Mode | Local data caching | Medium | 32 hours |
| NHS Integration | Data sharing protocols | Low | 80 hours |
| Multi-organization | White-label capabilities | Low | 60 hours |
| Appointment Booking | Counsellor scheduling | Medium | 40 hours |
| Secure Messaging | Peer-to-peer chat | Medium | 32 hours |
| Achievement Badges | Gamification system | Low | 24 hours |

### 10.3 Technical Debt & Improvements

| Item | Description | Priority |
|------|-------------|----------|
| CMS Full Integration | Connect all pages to CMS | High |
| AI Character Migration | Move to database from code | Medium |
| Legacy Code Cleanup | Remove deprecated files | Medium |
| Test Coverage | Automated testing suite | Medium |
| Performance Optimization | Caching, lazy loading | Low |

---

## 11. Appendix

### A. API Endpoint Summary

The platform exposes 50+ API endpoints across these categories:

- **Authentication** (7 endpoints): Login, register, password management
- **Staff Management** (12 endpoints): Counsellors, peers, organizations
- **CMS** (10 endpoints): Pages, sections, cards, content
- **Communication** (8 endpoints): Callbacks, live chat, calls
- **Safeguarding** (6 endpoints): Alerts, screening, panic
- **Analytics** (5 endpoints): Logs, statistics, exports
- **User Management** (4 endpoints): Users, profiles, settings

### B. Database Collections

| Collection | Purpose | Records (Est.) |
|------------|---------|----------------|
| users | User accounts | 50+ |
| counsellors | Counsellor profiles | 5-10 |
| peer_supporters | Peer profiles | 10-20 |
| organizations | Support organizations | 30+ |
| callbacks | Callback requests | 100+ |
| chat_rooms | Live chat sessions | 50+ |
| safeguarding_alerts | Risk alerts | Variable |
| shifts | Staff rota | 200+ |
| cms_pages | CMS page content | 10+ |
| cms_sections | Page sections | 50+ |
| cms_cards | Content cards | 100+ |
| survey_responses | Beta feedback | Growing |
| settings | System configuration | 10+ |

### C. Third-Party Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| OpenAI GPT-4 | AI chat engine | Active |
| Resend | Email notifications | Active |
| MongoDB Atlas | Database hosting | Active |
| Vercel | App hosting | Active |
| Render | API hosting | Active |
| 20i | Portal hosting | Active |

### D. Contact Information

**Radio Check**  
Veterans Mental Health & Peer Support

- Website: radiocheck.me
- App: app.radiocheck.me
- Admin: admin.radiocheck.me
- Staff: staff.radiocheck.me

---

*Document prepared: February 2026*  
*Platform Version: 2.6.0*  
*Status: Production - Live*

---

**END OF DOCUMENT**
