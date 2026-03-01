# Radio Check - Complete Feature Documentation

## Version 3.0 | December 2025

---

## Overview

Radio Check is a comprehensive mental health and peer support platform for UK military veterans. The application provides:

- **24/7 AI-supported engagement** with defined human operating hours
- **Immediate human connection** during operating hours (Mon-Fri 9am-5pm)
- **Multi-layer safeguarding** with crisis detection
- **Clinical governance infrastructure** (NHS DCB0129 aligned)
- **Triage and referral system** for external services

---

## 1. User Application Features

### Core Support Features

| Feature | Description | Status |
|---------|-------------|--------|
| **AI Battle Buddies** | 8 distinct AI personas for peer support | Active |
| **Live Chat** | Real-time text chat with staff | Active |
| **Voice Calls** | WebRTC-based in-app calling | Active |
| **Callback Requests** | Request a call back from staff | Active |
| **Crisis Support** | Emergency contacts with website links | Active |
| **Local Services** | Find veteran support by location | Active |
| **Self-Care Tools** | Wellness resources and techniques | Active |

### AI Battle Buddies

| Character | Personality | Purpose |
|-----------|-------------|---------|
| **Tommy** | Warm, steady squaddie | General peer support |
| **Doris** | Nurturing, compassionate | Safe space to talk |
| **Hugo** | Knowledgeable guide | Benefits, housing, legal help |
| **Finch** | Watchful companion | Practical guidance |
| **Bob** | Down-to-earth mate | Honest, real support |
| **Margie** | Wise, experienced | Life wisdom |
| **Rita** | Family-focused | Support for loved ones |
| **Catherine** | Calm, composed | Clear thinking under stress |

### Age Gate System

| Feature | Description | Status |
|---------|-------------|--------|
| **DOB Collection** | First-time users enter date of birth | Active |
| **Local Storage** | DOB stored on device only (privacy) | Active |
| **Under-18 Detection** | Automatic age verification | Active |
| **Feature Restrictions** | Peer matching disabled for minors | Active |
| **Enhanced Safety** | 1.3x risk multiplier for under-18s | Active |
| **Loading State** | Prevents content flash during check | Active |

### Safeguarding Flow

| Stage | Feature | Status |
|-------|---------|--------|
| **Detection** | Multi-layer AI risk scoring | Active |
| **Popup** | "We're Here For You" modal | Active |
| **Staff Busy Notice** | Operating hours indicator | Active |
| **Options** | Call / Chat / Callback / Continue | Active |
| **Crisis Resources** | Always visible Samaritans, 999 | Active |

### Peer Moderation

| Feature | Description | Status |
|---------|-------------|--------|
| **Report Button** | Flag inappropriate behaviour | Active |
| **Block Button** | Block another user | Active |
| **Report Queue** | Staff reviews reports | Active |
| **Moderation Actions** | Warning / Suspend / Ban | Active |

---

## 2. Staff Portal Features

### Tabbed Interface (V2)

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Stats, morning queue, phone status |
| **My Cases** | Case management (privacy-controlled) |
| **Alerts** | Safeguarding alert queue |
| **Callbacks** | Callback request management |
| **Live Chat** | Active chat room management |

### Case Management System

| Feature | Description | Status |
|---------|-------------|--------|
| **Case Creation** | Create from safeguarding alert | Active |
| **Privacy Controls** | Counsellors see own cases only | Active |
| **Session Tracking** | Max 3 triage sessions | Active |
| **Session Override** | Soft cap with reason required | Active |
| **Safety Plans** | Stanley-Brown template | Active |
| **Referral Tracking** | Status workflow for external services | Active |
| **Check-in Logging** | Monitor during waiting period | Active |
| **Handoff Summary** | PDF generation for Op COURAGE/NHS | Active |
| **Full Conversation** | Complete AI transcript captured | Active |

### Triage Session Documentation

| Field | Purpose |
|-------|---------|
| Presenting Issue | Main concern discussed |
| Risk Level | LOW / MODERATE / HIGH / IMMINENT |
| Protective Factors | Family, employment, hope, etc. |
| Warning Signs | Isolation, substance use, etc. |
| Session Outcome | Continue / Follow-up / Refer / Escalate |
| Actions Taken | Safety plan, resources, GP contact |
| Key Quotes | Verbatim statements for handoff |
| Next Steps | Agreed actions |

### Incident Reporting

| Feature | Description | Status |
|---------|-------------|--------|
| **Report Incident** | Staff can log safety incidents | Active |
| **Severity Levels** | Level 1/2/3 classification | Active |
| **Email Notifications** | Auto-notify CSO + Admin | Active |
| **Investigation Workflow** | Open → Investigating → Resolved | Active |

---

## 3. Admin Portal Features

### User Management

| Feature | Description | Status |
|---------|-------------|--------|
| **Create Users** | Add staff/admin accounts | Active |
| **Reset Passwords** | With complexity requirements | Active |
| **Password Confirmation** | Enter twice to confirm | Active |
| **Password History** | Cannot reuse last 3 | Active |
| **Role Management** | Admin/Staff/Counsellor/Peer | Active |

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- Cannot contain user's name
- Cannot reuse last 3 passwords

### Email Settings Management

| Setting | Purpose |
|---------|---------|
| Admin Email | Safeguarding alerts, general notifications |
| CSO Email | Incidents, approval requests |
| Peer Registration Email | New peer supporter signups |

### Content Management

| Feature | Description | Status |
|---------|-------------|--------|
| **CMS Pages** | Manage app content pages | Active |
| **Resources** | Manage resource library | Active |
| **Organizations** | Manage support organizations | Active |
| **AI Characters** | Database override ready | Prepared |

---

## 4. Clinical Governance System

### NHS DCB0129 Compliance

| Feature | Description | Status |
|---------|-------------|--------|
| **Hazard Register** | 7 core hazards (H1-H7) documented | Active |
| **Risk Scoring** | Severity × Likelihood (1-25) | Active |
| **CSO Role** | Clinical Safety Officer workflow | Active |
| **Incident Management** | 3-level system with notifications | Active |
| **Audit Trail** | All governance events logged | Active |
| **Annual Review** | CSO sign-off workflow | Active |

### Core Hazards

| ID | Hazard | Severity |
|----|--------|----------|
| H1 | AI fails to detect suicidal ideation | Catastrophic |
| H2 | AI over-escalates benign content | Minor |
| H3 | Staff miss urgent alert | Major |
| H4 | Under-18 falsely declares 18+ | Moderate |
| H5 | Peer messaging abuse | Moderate |
| H6 | System outage during crisis | Major |
| H7 | AI safety drift after update | Major |

### Safeguarding KPIs

| Metric | Target |
|--------|--------|
| High-risk response | < 15 mins |
| Imminent risk response | < 5 mins |
| SLA compliance | > 90% |
| False positive rate | < 15% |

### AI Compliance Checker

| Framework | Coverage |
|-----------|----------|
| NHS DCB0129 | Clinical risk management |
| Samaritans AI Policy | Suicide prevention guidelines |
| Online Safety Act | Platform safety requirements |
| ICO Data Protection | AI decision transparency |

---

## 5. Real-Time Communication

### WebRTC Calling

| Feature | Description | Status |
|---------|-------------|--------|
| **In-App Calls** | Browser-to-browser audio | Active |
| **TURN Server** | NAT traversal (ExpressTURN) | Active |
| **Call Signaling** | Socket.IO based | Active |
| **Staff Phone Bar** | Status and controls | Active |

### Live Chat

| Feature | Description | Status |
|---------|-------------|--------|
| **Room Creation** | User initiates chat | Active |
| **Staff Join** | Staff accepts chat request | Active |
| **Real-Time Messages** | Socket.IO messaging | Active |
| **Typing Indicators** | Shows when other is typing | Active |
| **Report/Block** | User safety controls | Active |

---

## 6. Safety Features

### Multi-Layer AI Safety

| Layer | Function |
|-------|----------|
| Layer 1 | 400+ crisis keywords |
| Layer 2 | Contextual phrase patterns |
| Layer 3 | Session escalation detection |
| Layer 4 | AI dependency detection |

### Risk Levels

| Level | Score | Response |
|-------|-------|----------|
| GREEN | 0-15 | Normal conversation |
| YELLOW | 16-30 | Increased monitoring |
| AMBER | 31-50 | Soft crisis resources |
| RED | 51-100 | Safeguarding popup |
| IMMINENT | 100+ | Immediate resources + alert |

### Samaritans AI Policy Compliance

| Requirement | Status |
|-------------|--------|
| Refuse harmful instructions | Implemented |
| No glorifying/romanticizing | Implemented |
| Redirect to crisis support | Implemented |
| Human escalation pathway | Implemented |
| Age-appropriate safeguards | Implemented |
| Session-aware monitoring | Implemented |
| Dependency detection | Implemented |
| Audit logging | Implemented |
| Qualified human oversight | Implemented |

---

## 7. Operating Model

### Human Support Hours
- **Monday - Friday**: 9am - 5pm GMT
- **Outside Hours**: AI engagement with morning review queue

### User Journey

```
First Contact → AI Engagement → Risk Detection
       ↓              ↓              ↓
   (Low Risk)    (Monitoring)    (High Risk)
       ↓              ↓              ↓
   Continue      Peer Support    Safeguarding
                      ↓              ↓
               Triage Session    Human Contact
                      ↓              ↓
                Safety Plan     Crisis Resources
                      ↓
                  Referral
                      ↓
              External Service
```

### Referral Services

| Category | Services |
|----------|----------|
| Op COURAGE | All UK regions |
| NHS | IAPT, CMHT |
| Charities | Combat Stress, Help for Heroes, SSAFA |

---

## 8. Deployment Architecture

| Component | Host |
|-----------|------|
| Frontend | Vercel |
| Backend | Render |
| Admin Portal | 20i (manual upload) |
| Staff Portal | 20i (manual upload) |
| Database | MongoDB Atlas |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | Dec 2025 | Case management, compliance checker, peer moderation |
| 2.0 | Dec 2025 | Governance system, age gate, email notifications |
| 1.0 | Nov 2025 | Initial release |

---

*Document Version: 3.0*
*Last Updated: December 2025*
*Review Date: March 2026*
