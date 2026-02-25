# Radio Check - Veterans Mental Health Support Platform
## Board Presentation Documentation

![Radio Check Logo](logo.png)

---

## Executive Summary

**Radio Check** is a comprehensive mental health and peer support platform designed specifically for UK military veterans. The platform provides 24/7 access to AI-powered support companions, peer support networks, crisis resources, and professional counselling services.

### Platform Components
1. **Mobile App** (iOS/Android/Web) - Main veteran-facing application
2. **Staff Portal** - For peer supporters and counsellors
3. **Admin Portal** - Full administrative control and analytics
4. **Marketing Website** - Public-facing promotional site

---

## Development Timeline

| Phase | Duration | Details |
|-------|----------|---------|
| Initial Development | Feb 2025 | Core app structure, authentication, AI chat |
| Staff & Admin Portals | Feb 2025 | Portal development, shift management |
| CMS & Content | Feb 2025 | Content management system, dynamic content |
| Testing & Refinement | Feb 2025 | Bug fixes, UX improvements |
| **Total Development** | **~4 weeks** | Ongoing iterative development |

### Technology Stack
- **Frontend**: React Native (Expo) - Cross-platform mobile & web
- **Backend**: Python FastAPI - High-performance API
- **Database**: MongoDB - Flexible document storage
- **AI**: OpenAI GPT-4 - Intelligent chat companions
- **Hosting**: Vercel (App), Render (Backend), 20i (Portals)

---

## 1. MOBILE APPLICATION FEATURES

### 1.1 Home Screen
- **Quick Access Menu** with 10 main navigation options
- **AI Team Section** - Meet and chat with AI companions
- **Dark/Light Theme** support throughout

### 1.2 Crisis Support
- **Need to Talk?** - Immediate access to crisis resources
- **Crisis Helplines** - Samaritans (116 123), Veterans UK (0808 1914 218), NHS 111
- **One-tap calling** to emergency services

### 1.3 AI Support Companions (24/7 Available)
| Character | Specialty | Description |
|-----------|-----------|-------------|
| **Tommy** | Battle Buddy | Straightforward military peer support |
| **Doris** | Emotional Support | Nurturing, compassionate listener |
| **Bob** | Ex-Para Veteran | Real-talk from someone who's been there |
| **Finch** | Military Law | UK military legal expertise |
| **Margie** | Addiction Support | Help with alcohol, drugs, gambling |
| **Hugo** | Wellbeing Coach | Mental health and daily habits |
| **Rita** | Family Support | For partners, spouses, and loved ones |

### 1.4 Peer Support Features
- **Talk to a Veteran** - Connect with trained peer supporters
- **Request a Callback** - Schedule a call from support staff
- **Buddy Finder** - Match with compatible peer supporters

### 1.5 Self-Care Tools
- **Mood Journal** - Daily emotional tracking
- **Grounding Exercises** - 5-4-3-2-1 technique
- **Breathing Exercises** - Guided relaxation
- **Wellness Resources** - Curated self-help content

### 1.6 Specialized Support Areas
- **Warfare on Lawfare** - Historical investigations support
- **Criminal Justice Support** - Help for veterans in/leaving prison
- **Addictions** - Alcohol, drugs, gambling support
- **Friends & Family** - Resources for loved ones

### 1.7 Additional Features
- **Support Organisations** - Directory of veteran services
- **Recommended Podcasts** - Mental health content
- **Settings** - Theme, notifications, privacy controls
- **Consent Management** - GDPR-compliant data controls

---

## 2. STAFF PORTAL FEATURES

### 2.1 Dashboard
- **Live Status Overview** - Online staff count
- **Today's Shifts** - Current shift coverage
- **Pending Callbacks** - Queue of callback requests
- **Quick Statistics** - Key metrics at a glance

### 2.2 Availability Management
- **Status Toggle** - Available/Busy/Offline
- **Shift Calendar** - View and manage shifts
- **Add Availability** - Register for shift slots
- **Shift Swaps** - Request/approve shift exchanges

### 2.3 Callback Management
- **Callback Queue** - View pending requests
- **Callback Details** - User info, reason, urgency
- **Status Updates** - Mark as contacted/completed
- **Notes** - Add follow-up notes

### 2.4 Communication
- **Live Chat** - Real-time text support
- **Audio Calls** - Peer-to-peer voice calls (WebRTC)
- **Message History** - View past conversations

### 2.5 Safeguarding
- **Concern Logging** - Report safeguarding issues
- **Escalation Protocols** - Clear escalation paths
- **Incident Reports** - Document serious concerns

### 2.6 Staff Rota
- **Monthly Calendar View** - See all staff shifts
- **Staff Names Display** - Know who's working when
- **Gap Detection** - Identify uncovered periods
- **Shift Notifications** - Reminders for upcoming shifts

---

## 3. ADMIN PORTAL FEATURES

### 3.1 Dashboard
- **User Statistics** - Total users, active users
- **Staff Overview** - Online count, availability
- **Callback Metrics** - Pending, completed today
- **System Health** - API status, performance

### 3.2 User Management
- **User Directory** - Searchable user list
- **Role Assignment** - Admin, Staff, User roles
- **Account Actions** - Enable/disable accounts
- **User Analytics** - Activity tracking

### 3.3 Staff Management
- **Staff Directory** - All peer supporters
- **Status Control** - Change staff availability
- **Performance Metrics** - Calls handled, ratings
- **Training Records** - Certification tracking

### 3.4 Content Management System (CMS)
- **Visual Editor** - Split-screen editing
- **Live Preview** - Phone mockup preview
- **Page Management** - Edit all app pages
- **Card Editor** - Icons, colors, descriptions
- **Section Management** - Add/remove/reorder content

### 3.5 Beta Testing Dashboard
- **Feature Flag Toggle** - Enable/disable beta surveys
- **Survey Statistics** - Pre/post survey counts
- **Completion Rates** - Track user engagement
- **NPS Score** - Net Promoter Score tracking
- **Improvement Metrics** - Wellbeing change data
- **CSV Export** - Download survey data

### 3.6 Compliance & Documentation
- **ROPA** - Record of Processing Activities (PDF)
- **GDPR Audit Report** - Data protection compliance
- **BACP Compliance** - Ethical framework adherence
- **Incident Response Plan** - Emergency procedures
- **Security Review Schedule** - Regular audit calendar
- **Safeguarding Disclaimer** - Child protection policies

### 3.7 Logs & Analytics
- **Activity Logs** - User actions tracking
- **API Logs** - Request/response monitoring
- **Error Tracking** - System error reports
- **Usage Analytics** - Feature adoption metrics

### 3.8 Monitoring
- **System Status** - Backend health
- **Database Status** - MongoDB connectivity
- **API Response Times** - Performance metrics
- **Error Rates** - Issue frequency tracking

### 3.9 Settings
- **Organization Settings** - Branding, contact info
- **Notification Settings** - Email/SMS configuration
- **Security Settings** - Password policies
- **Data Retention** - Automated cleanup rules

---

## 4. MARKETING WEBSITE FEATURES

### 4.1 Public Pages
- **Home Page** - Mission statement, hero section
- **About Us** - Organization background
- **Services** - What we offer
- **Get the App** - Download links
- **Contact** - Get in touch form

### 4.2 Information Pages
- **Terms of Service** - Legal terms
- **Privacy Policy** - Data handling
- **Cookie Policy** - Tracking disclosure
- **Accessibility** - A11y statement

---

## 5. TECHNICAL COMPLIANCE

### 5.1 Data Protection (GDPR)
- ✅ Consent management
- ✅ Data export capability
- ✅ Right to deletion
- ✅ Privacy by design
- ✅ Data minimization

### 5.2 Clinical Standards (BACP)
- ✅ Ethical framework compliance
- ✅ Safeguarding protocols
- ✅ Confidentiality measures
- ✅ Professional boundaries

### 5.3 Accessibility
- ✅ Screen reader compatible
- ✅ Color contrast compliance
- ✅ Keyboard navigation
- ✅ Text scaling support

### 5.4 Security
- ✅ HTTPS everywhere
- ✅ Authentication tokens
- ✅ Password hashing
- ✅ Session management
- ✅ Input validation

---

## 6. FUTURE ROADMAP

### Phase 2 (Planned)
- [ ] Push notifications for appointments
- [ ] Video call support
- [ ] Mood tracking graphs over time
- [ ] Welsh language support
- [ ] Structured CBT courses

### Phase 3 (Future)
- [ ] Native iOS/Android app store release
- [ ] Offline mode capabilities
- [ ] Integration with NHS systems
- [ ] Multi-organization support

---

## Contact Information

**Radio Check**
Veterans Mental Health Support

Website: radiocheck.me
Admin Portal: admin.radiocheck.me
Staff Portal: staff.radiocheck.me

---

*Document generated: February 2026*
*Version: 2.6.0*
