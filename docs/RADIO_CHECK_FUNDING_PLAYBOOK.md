# Radio Check - Funding Playbook

## Executive Summary

**Radio Check** is a comprehensive digital mental health and peer support platform designed specifically for UK military veterans. The application combines AI-powered crisis detection with real-time human support, creating a unique safety net for veterans who may be struggling with mental health challenges.

---

## The Problem We're Solving

### Veterans Mental Health Crisis in Numbers
- **13 veterans per week** take their own lives in the UK (ONS data)
- **Veterans are 2-3x more likely** to experience mental health issues
- **Stigma and isolation** prevent many from seeking traditional help
- **24/7 support** is often unavailable through standard NHS services
- **Waiting times** for mental health support can exceed 18 weeks

### The Gap in Current Services
- Traditional helplines can feel impersonal
- No peer-to-peer veteran support available 24/7
- No proactive monitoring for at-risk individuals
- Limited accessibility for those uncomfortable with formal services

---

## Our Solution: Radio Check

Radio Check provides **immediate, accessible, and intelligent support** through three key pillars:

### 1. AI-Powered Early Intervention
Our proprietary safeguarding system monitors conversations for signs of distress and automatically alerts trained staff when intervention may be needed.

### 2. Peer Support Network
Veterans can connect with other veterans who understand their experiences - available 24/7 through voice calls and live chat.

### 3. Professional Support Integration
Trained counsellors and mental health professionals available for escalation when needed.

---

## Platform Overview

### User Application (Mobile & Web)

The veteran-facing app provides:

| Feature | Description |
|---------|-------------|
| **Need to Talk?** | Immediate connection to support - one tap access |
| **Talk to a Veteran** | Peer-to-peer support from those who understand |
| **AI Buddies** | 24/7 AI companions for when human support isn't available |
| **Self-Care Tools** | Journaling, breathing exercises, grounding techniques |
| **Support Directory** | Comprehensive directory of veteran services |
| **Warfare on Lawfare** | Support for historical investigations |
| **Friends & Family** | Resources for those worried about a veteran |

### Key User Features

#### Immediate Crisis Support
- **One-tap access** to human support
- **Clear escalation path** from AI to human when needed
- **999 emergency reminder** always visible
- **No registration required** for crisis support

#### AI Companions
- Multiple AI personas trained in veteran support
- Available 24/7 when human supporters are unavailable
- Conversation monitoring for safety
- Warm handoff to humans when needed

#### Self-Care Tools
- Guided breathing exercises
- Grounding techniques for anxiety
- Private journaling
- Progress tracking

---

## Staff Portal

The staff portal provides trained supporters with tools to help veterans effectively:

### Dashboard Features

| Feature | Description |
|---------|-------------|
| **Real-time Alerts** | Safeguarding alerts appear instantly when AI detects risk |
| **Live Chat** | Text-based support with typing indicators |
| **Voice Calls** | WebRTC-powered secure voice communication |
| **User Context** | See relevant history to provide informed support |
| **Team Coordination** | See who's online, manage handoffs |

### Safeguarding System

The multi-layered safeguarding system includes:

#### Risk Level Classification
- **RED** - Immediate escalation required (suicide ideation, immediate danger)
- **AMBER** - High risk requiring attention (self-harm references, severe distress)
- **YELLOW** - Elevated concern (persistent low mood, isolation)
- **GREEN** - Normal conversation

#### Trigger Analysis
- **55+ RED indicators** - Immediate escalation phrases
- **118+ AMBER indicators** - High-risk language patterns
- **Contextual modifiers** - Language that increases concern level

#### Alert Actions
- One-click acknowledge
- Direct call to user
- Live chat initiation
- Case resolution with notes

### WebRTC Communication
- **Browser-based calls** - No app installation required for staff
- **Secure end-to-end** - Privacy protected
- **Call status tracking** - See availability, manage queues

---

## Admin Portal

The admin portal provides complete organizational control:

### User Management
| Feature | Description |
|---------|-------------|
| **Staff Accounts** | Create and manage counsellor/peer accounts |
| **Role Assignment** | Admin, Counsellor, Peer supporter roles |
| **Access Control** | Granular permissions per role |

### Content Management System (CMS)
| Feature | Description |
|---------|-------------|
| **AI Persona Editor** | Customize AI companion personalities |
| **Resource Management** | Update support organization directory |
| **Crisis Numbers** | Manage emergency contact information |
| **App Content** | Update text throughout the application |

### Rota & Scheduling
| Feature | Description |
|---------|-------------|
| **Shift Management** | Create and assign shifts |
| **Calendar View** | Visual schedule overview |
| **Availability Tracking** | See who's scheduled when |
| **Shift Swap Requests** | Enable staff to swap shifts |

### Monitoring & Analytics
| Feature | Description |
|---------|-------------|
| **Real-time Dashboard** | Live system health monitoring |
| **Safeguarding Monitor** | Review AI detection accuracy |
| **Trigger Phrase Testing** | Test and refine detection phrases |
| **Usage Statistics** | Conversation volumes, response times |

### Compliance & Reporting
| Feature | Description |
|---------|-------------|
| **PDF Report Generation** | Download compliance documents |
| **Audit Trails** | Track all administrative actions |
| **Data Export** | GDPR-compliant data management |

---

## Technology Stack

### Frontend
- **React Native + Expo** - Cross-platform mobile and web
- **WebRTC** - Secure real-time communications
- **Socket.IO** - Real-time messaging

### Backend
- **Python FastAPI** - High-performance API
- **MongoDB** - Flexible document storage
- **OpenAI GPT-4** - AI conversation capabilities

### Infrastructure
- **Render** - Scalable cloud hosting
- **Vercel** - Frontend deployment
- **ExpressTURN** - WebRTC TURN servers

### Security
- **JWT Authentication** - Secure access tokens
- **HTTPS/WSS** - Encrypted communications
- **Role-based Access** - Granular permissions

---

## Branding Guidelines

### Logo
The Radio Check logo features a compass/radar design symbolizing:
- **Navigation** - Helping veterans find their way
- **Detection** - Our safeguarding radar
- **Connection** - The compass needle pointing to support

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Dark** | `#1E3A5F` | Main backgrounds, headers |
| **Primary Teal** | `#0D9488` | Primary buttons, accents |
| **Success Green** | `#16A34A` | Positive actions, safe status |
| **Warning Amber** | `#F59E0B` | Caution, AMBER alerts |
| **Danger Red** | `#DC2626` | Urgent, RED alerts |
| **Text Primary** | `#1F2937` | Main text |
| **Text Muted** | `#6B7280` | Secondary text |
| **Background** | `#F8FAFC` | Page backgrounds |

### Typography
- **Headings**: System fonts, bold weight
- **Body**: System fonts, regular weight
- **Mobile-first**: Responsive sizing

### Tone of Voice
- **Warm and supportive** - Never clinical
- **Veteran-aware** - Understanding military culture
- **Non-judgmental** - Safe space for expression
- **Action-oriented** - Clear next steps

---

## Unique Value Proposition

### What Makes Radio Check Different

| Feature | Traditional Helplines | Radio Check |
|---------|----------------------|-------------|
| **Peer Support** | Rarely available | Core feature |
| **AI Monitoring** | None | Proactive detection |
| **24/7 AI Backup** | None | Always available |
| **Veteran-Specific** | Generic | Purpose-built |
| **WebRTC Calls** | Phone only | Browser-based |
| **Self-Service Tools** | None | Comprehensive |

### Innovation Highlights

1. **Proactive Safeguarding** - We don't wait for crisis, we detect warning signs
2. **Hybrid AI/Human Model** - Best of both worlds
3. **No-Barrier Access** - Anonymous support available
4. **Military Culture Aware** - Built by and for veterans

---

## Impact Metrics (Targets)

### Year 1 Goals
- **1,000** registered veterans
- **5,000** support conversations
- **50** active peer supporters
- **10** safeguarding interventions preventing serious harm

### Year 3 Goals
- **10,000** registered veterans
- **50,000** support conversations
- **200** active peer supporters
- **100** documented positive interventions

---

## Funding Requirements

### Seed Funding: £150,000

| Category | Amount | Purpose |
|----------|--------|---------|
| **Development** | £60,000 | Platform completion, mobile apps |
| **Operations** | £40,000 | Server costs, staff training |
| **Marketing** | £30,000 | Veteran outreach, partnerships |
| **Legal/Compliance** | £10,000 | Data protection, safeguarding policies |
| **Contingency** | £10,000 | Unexpected costs |

### Use of Funds Timeline

**Months 1-3**: Complete development, beta testing
**Months 4-6**: Soft launch, gather feedback
**Months 7-9**: Full launch, marketing push
**Months 10-12**: Scale operations, evaluate impact

---

## Team

### Current Team
- **Technical Lead** - Platform development and AI integration
- **Veterans Liaison** - Community engagement and peer recruitment
- **Clinical Advisor** - Safeguarding protocols and training

### Planned Hires (Post-Funding)
- Operations Manager
- Marketing Coordinator
- Additional Developers

---

## Partners & Supporters

- Veteran charities (TBC)
- NHS Mental Health partnerships (In discussion)
- Military transition organizations (In discussion)

---

## Contact

**Radio Check**
Supporting UK Veterans' Mental Health

Website: app.radiocheck.me
Admin Portal: admin.radiocheck.me
Staff Portal: staff.radiocheck.me

---

## Appendices

### A. Technical Architecture Diagram
*See separate technical documentation*

### B. Safeguarding Policy
*See separate safeguarding documentation*

### C. GDPR Compliance Statement
*See separate data protection documentation*

### D. User Testimonials
*To be added from beta testing*

---

*Document Version: 1.0*
*Last Updated: February 2026*
