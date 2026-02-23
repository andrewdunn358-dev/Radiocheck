# Radio Check - Complete Feature, Safety & Compliance Document

---

## PART 1: COMPLETE FEATURE LIST

### A. User-Facing Features (Mobile App)

#### 1. AI Support System
| Feature | Description | Status |
|---------|-------------|--------|
| 7 AI Characters | Tommy, Doris, Bob, Finch, Margie, Hugo, Rita | ✅ Working |
| 24/7 Availability | Always accessible, no waiting times | ✅ Working |
| Military-Trained AI | Understands veteran terminology & culture | ✅ Working |
| Crisis Detection | Automatically flags concerning messages | ✅ Working |
| Knowledge Base | UK veteran-specific information | ✅ Working |
| Consent Modal | GDPR-compliant consent before each chat | ✅ Working |

#### 2. Mental Health Tools
| Feature | Description | Status |
|---------|-------------|--------|
| PHQ-9 Screening | Clinical depression assessment (9 questions) | ✅ Working |
| GAD-7 Screening | Clinical anxiety assessment (7 questions) | ✅ Working |
| Score Interpretation | Severity levels with explanations | ✅ Working |
| Share with Counsellor | Send results to support team | ✅ Working |
| Mood Tracking | Daily emoji-based check-ins | ✅ Working |
| Mood History Graph | Visual timeline of mood over time | ✅ Working |
| Trend Analysis | Improving/Stable/Declining indicators | ✅ Working |
| Streak Tracking | Encourages daily check-ins | ✅ Working |

#### 3. Self-Care Tools
| Feature | Description | Status |
|---------|-------------|--------|
| Breathing Exercises | Box breathing, 4-7-8 technique | ✅ Working |
| Grounding Techniques | 5-4-3-2-1 sensory exercise | ✅ Working |
| Personal Journal | Private thoughts diary | ✅ Working |
| Resources Library | Educational content | ✅ Working |

#### 4. Human Support
| Feature | Description | Status |
|---------|-------------|--------|
| Request Callback | Veterans request call from staff | ✅ Working |
| Live Chat | Real-time text chat with staff | ✅ Working |
| Voice Calls | Peer-to-peer audio calls (WebRTC) | ✅ Working |
| Panic Button (SOS) | Emergency alert to staff | ✅ Working |

#### 5. Community Features
| Feature | Description | Status |
|---------|-------------|--------|
| Buddy Finder | Connect with other veterans | ✅ Working |
| Peer Matching | Filter by service, location, interests | ✅ Working |
| Secure Messaging | Between matched buddies | ✅ Working |
| Podcasts | Curated veteran mental health podcasts | ✅ Working |

#### 6. Information & Settings
| Feature | Description | Status |
|---------|-------------|--------|
| Crisis Numbers | Always visible (Samaritans, Combat Stress) | ✅ Working |
| Your Data Rights | GDPR information page | ✅ Working |
| Safeguarding Policy | Safety information | ✅ Working |
| Report an Issue | Complaints & feedback | ✅ Working |
| Privacy Settings | Control data sharing | ✅ Working |

### B. Staff Portal Features

| Feature | Description | Status |
|---------|-------------|--------|
| Staff Dashboard | Overview of duties | ✅ Working |
| Callback Queue | Manage veteran callbacks | ✅ Working |
| Live Chat Management | Handle multiple chats | ✅ Working |
| Shift Calendar | View own shifts | ✅ Working |
| Team Visibility | See who else is on duty | ✅ Working |
| Shift Swap Requests | Request/accept cover | ✅ Working |
| Case Notes | Document interactions | ✅ Working |

### C. Admin Portal Features

| Feature | Description | Status |
|---------|-------------|--------|
| Staff Management | Add/edit counsellors & peers | ✅ Working |
| Rota Dashboard | Who's on shift, coverage gaps | ✅ Working |
| Swap Approvals | Approve/reject shift swaps | ✅ Working |
| CMS | Dynamic content management | ✅ Working |
| Safeguarding Alerts | View flagged concerns | ✅ Working |
| Compliance Dashboard | Audit logs, GDPR requests | ✅ Working |
| Analytics | Usage statistics | ✅ Working |
| Data Retention | Automated cleanup tools | ✅ Working |
| Test User Cleanup | Remove test data | ✅ Working |

---

## PART 2: GDPR COMPLIANCE

### What We Have Implemented

#### Data Collection & Consent
| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Lawful Basis | Consent-based processing | ✅ |
| Consent Collection | AI chat consent modals | ✅ |
| Cookie Consent | Banners on all web portals | ✅ |
| Privacy Notice | Clear information provided | ✅ |
| Purpose Limitation | Data used only for stated purposes | ✅ |

#### Data Subject Rights
| Right | Implementation | Status |
|-------|---------------|--------|
| Right to Access | Export own data via settings | ✅ |
| Right to Rectification | Edit profile information | ✅ |
| Right to Erasure | Delete account & all data | ✅ |
| Right to Restrict Processing | Can opt out of AI processing | ✅ |
| Right to Data Portability | JSON export of all data | ✅ |
| Right to Object | Report an Issue button | ✅ |

#### Data Protection Measures
| Measure | Implementation | Status |
|---------|---------------|--------|
| Data Minimisation | Only collect necessary data | ✅ |
| Storage Limitation | Auto-deletion policies | ✅ |
| Data Retention Script | Automated cleanup | ✅ |
| Audit Logging | All access logged | ✅ |
| GDPR Deletion Log | Track deletion requests | ✅ |

#### API Endpoints for GDPR
```
GET  /api/auth/my-data/export     - Export all user data
DELETE /api/auth/me               - Delete account
DELETE /api/admin/data-retention/user-data/{id} - Admin deletion
GET  /api/admin/data-retention/gdpr-requests    - Deletion audit
```

### Data Retention Periods
| Data Type | Retention | Action |
|-----------|-----------|--------|
| Chat Messages | 90 days | Anonymised |
| Safeguarding Alerts | 7 years | Anonymised (legal requirement) |
| Callback Requests | 1 year | Anonymised |
| Call Logs | 1 year | Anonymised |
| Panic Alerts | 1 year | Deleted |
| Compliance Logs | 2 years | Deleted |

---

## PART 3: SAFETY & SAFEGUARDING

### Crisis Detection System

#### How It Works
1. AI monitors all chat messages for concerning keywords
2. Flags automatically raised for review
3. Staff notified via safeguarding dashboard
4. Escalation procedures triggered

#### Trigger Keywords (Examples)
- Suicide, self-harm, end it all
- Abuse, hurt, danger
- Overdose, pills
- And many more...

#### Response Protocol
1. **Immediate**: Crisis resources displayed
2. **Within 1 hour**: Staff review flagged message
3. **If urgent**: Phone callback attempted
4. **Documentation**: All actions logged

### Safeguarding Features
| Feature | Description |
|---------|-------------|
| Automatic Flagging | AI detects concerning content |
| Staff Alerts | Dashboard shows all flags |
| Severity Levels | Low/Medium/High prioritisation |
| Audit Trail | All actions documented |
| Escalation Path | Clear procedures |

### Crisis Resources Always Available
- **Samaritans**: 116 123 (24/7, free)
- **Combat Stress**: 0800 138 1619
- **Veterans UK**: 0808 1914 218
- **NHS Mental Health**: 111 (option 2)
- **Emergency**: 999

---

## PART 4: ENCRYPTION & SECURITY

### Current Security Measures

#### Data in Transit
| Measure | Status |
|---------|--------|
| HTTPS/TLS | ✅ All connections encrypted |
| SSL Certificates | ✅ Via hosting providers |
| API Security | ✅ JWT authentication |

#### Data at Rest
| Measure | Status |
|---------|--------|
| Database Encryption | ✅ MongoDB Atlas encryption |
| Password Hashing | ✅ bcrypt with salt |
| Sensitive Data | ⚠️ Partially encrypted |

#### Authentication
| Measure | Status |
|---------|--------|
| JWT Tokens | ✅ Secure token-based auth |
| Token Expiry | ✅ 24-hour expiry |
| Password Requirements | ✅ Minimum strength required |

### Areas for Improvement

#### HIGH PRIORITY
| Improvement | Description | Estimated Cost |
|-------------|-------------|----------------|
| PII Encryption | Encrypt names, emails, phone numbers | £500-1000 |
| End-to-End Chat | Encrypt messages client-side | £2000-5000 |
| Field-Level Encryption | Individual database fields | £1000-2000 |

#### MEDIUM PRIORITY
| Improvement | Description | Estimated Cost |
|-------------|-------------|----------------|
| 2FA | Two-factor authentication | £500-1000 |
| Session Management | Better token handling | £300-500 |
| Security Audit | Professional penetration testing | £2000-5000 |

#### NICE TO HAVE
| Improvement | Description | Estimated Cost |
|-------------|-------------|----------------|
| Biometric Login | Fingerprint/Face ID | £500-1000 |
| Audit Logging Enhancement | More detailed logs | £300-500 |
| Intrusion Detection | Automated threat detection | £1000-2000 |

---

## PART 5: COMPLIANCE FRAMEWORKS

### BACP Alignment (British Association for Counselling & Psychotherapy)

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Clear AI Disclaimers | Consent modal on each chat | ✅ |
| Not Therapy Statement | AI is not a replacement message | ✅ |
| Crisis Resources | Always visible | ✅ |
| Safeguarding Procedures | Flagging system | ✅ |
| Complaints Process | Report an Issue button | ✅ |
| Confidentiality | Privacy policy | ✅ |
| Record Keeping | Audit logs | ✅ |

### ICO (Information Commissioner's Office) Compliance

| Requirement | Status |
|-------------|--------|
| Privacy Notice | ✅ |
| Lawful Basis Documented | ✅ |
| Data Protection Officer (if needed) | ⚠️ May need if processing at scale |
| Data Breach Procedures | ⚠️ Need formal document |
| DPIA (Data Protection Impact Assessment) | ⚠️ Recommended for AI processing |

### NHS Digital Standards (If Seeking NHS Integration)

| Requirement | Status |
|-------------|--------|
| DCB0129 Clinical Safety | ❌ Not assessed |
| DCB0160 Security | ⚠️ Partial |
| NHS Login Integration | ❌ Not implemented |
| IG Toolkit | ❌ Not submitted |

---

## PART 6: MENTAL HEALTH LIMITATIONS

### What The App CAN Do
✅ Provide 24/7 supportive conversation
✅ Screen for depression (PHQ-9) and anxiety (GAD-7)
✅ Track mood over time
✅ Connect veterans with peers and staff
✅ Provide self-help tools (breathing, grounding)
✅ Detect crisis situations and flag for help
✅ Provide educational resources
✅ Facilitate callbacks with trained staff

### What The App CANNOT Do
❌ **Diagnose** mental health conditions
❌ **Prescribe** medication or treatment
❌ **Replace** professional therapy or psychiatry
❌ **Provide** clinical treatment
❌ **Guarantee** safety in crisis situations
❌ **Override** emergency services (999)
❌ **Conduct** formal psychological assessments
❌ **Certify** fitness for work or legal purposes

### Clear Disclaimers in App
> "This AI companion is not a trained counsellor or therapist. It cannot diagnose conditions or provide medical advice. If you're in crisis, please contact Samaritans on 116 123 or call 999 for emergencies."

---

## PART 7: RECRUITING & TRAINING PEER SUPPORTERS

### Who Can Be a Peer Supporter?
- Veterans with lived experience
- Good mental health stability (minimum 2 years)
- Completed basic training
- DBS checked
- References verified

### Recruitment Channels
| Channel | Approach |
|---------|----------|
| Veteran Charities | Partner with RBL, SSAFA, Combat Stress |
| Military Networks | Regimental associations |
| Social Media | Veteran Facebook groups, LinkedIn |
| Word of Mouth | Existing supporters refer others |
| Job Boards | Indeed, Charity Job |
| Universities | Psychology/counselling students |

### Training Requirements
| Training | Duration | Provider Options |
|----------|----------|------------------|
| Mental Health First Aid | 2 days | MHFA England |
| Safeguarding | 1 day | Local authority / online |
| Active Listening | 1 day | Internal or charity partner |
| App Training | Half day | Internal |
| Supervision Skills | Ongoing | Clinical supervisor |

### Training Costs (Per Person)
| Item | Cost |
|------|------|
| MHFA Course | £200-300 |
| Safeguarding | £50-100 |
| DBS Check | £23-60 |
| Internal Training | Staff time |
| **Total per volunteer** | **~£300-500** |

### Ongoing Support
- Monthly group supervision
- Access to clinical supervisor
- Peer support between supporters
- Annual refresher training
- Wellbeing check-ins

---

## PART 8: RECRUITING COUNSELLORS

### Qualifications Required
- Minimum Level 4 Diploma in Counselling
- BACP/UKCP/NCS registered (or working towards)
- Insurance (professional indemnity)
- DBS enhanced check
- Ideally: Military experience or understanding

### Recruitment Channels
| Channel | Notes |
|---------|-------|
| BACP Job Board | Professional counsellors |
| Counselling Directory | Find local practitioners |
| University Placements | Students needing hours |
| NHS IAPT Services | May partner for referrals |
| Military Charities | Combat Stress, Help for Heroes |

### Volunteer vs Paid
| Type | Pros | Cons |
|------|------|------|
| **Volunteer** | Low cost, motivated | Unreliable hours, turnover |
| **Paid Part-Time** | Committed, professional | Cost (£20-40/hour) |
| **Paid Full-Time** | Consistent, career | High cost (£30-50k/year) |

### Supervision Requirements
- All counsellors need clinical supervision
- Minimum 1.5 hours per month per counsellor
- Supervisor must be experienced practitioner
- Cost: £50-80 per supervision hour

---

## PART 9: FUNDING SOURCES

### Grant Funding

#### Military & Veteran Specific
| Funder | Typical Grants | Application |
|--------|---------------|-------------|
| Armed Forces Covenant Fund Trust | £10k-500k | Annual rounds |
| Veterans Foundation | £5k-50k | Rolling applications |
| Royal British Legion | Varies | Partnerships |
| Help for Heroes | Project-based | Direct approach |
| Combat Stress | Partnership | Direct approach |

#### Mental Health Specific
| Funder | Typical Grants | Notes |
|--------|---------------|-------|
| National Lottery Community Fund | £10k-500k | Large projects |
| Comic Relief | £30k-300k | Tech for Good strand |
| Wellcome Trust | Research-focused | Academic partner needed |
| NHS Charities Together | £10k-100k | Healthcare focus |

#### Tech/Innovation
| Funder | Notes |
|--------|-------|
| Nesta | Social innovation |
| UnLtd | Social entrepreneurs |
| Nominet | Tech for good |
| Google.org | Technology nonprofits |

### Corporate Sponsorship
- Defence contractors (BAE, Thales)
- Banks with armed forces schemes (Barclays, NatWest)
- Supermarkets (Tesco, Asda - community funds)

### Crowdfunding
- JustGiving
- GoFundMe
- Kickstarter (for specific features)

### NHS Commissioning
- Clinical Commissioning Groups (CCGs)
- Integrated Care Systems (ICS)
- NHS England Innovation funding

---

## PART 10: COST COMPARISON - DIY vs AGENCY

### What You've Built (AI-Assisted Development)

| Component | Traditional Agency Cost | Your Actual Cost |
|-----------|------------------------|------------------|
| Mobile App (iOS/Android/Web) | £50,000-150,000 | ~£500 (AI credits) |
| Backend API | £20,000-50,000 | Included |
| Admin Portal | £15,000-30,000 | Included |
| Staff Portal | £15,000-30,000 | Included |
| Database Setup | £5,000-10,000 | Included |
| AI Integration | £10,000-30,000 | Included |
| 7 AI Characters | £20,000-50,000 | Included |
| CMS System | £10,000-25,000 | Included |
| Compliance Features | £10,000-20,000 | Included |
| **TOTAL** | **£155,000-395,000** | **~£500-1000** |

### Time Comparison
| Approach | Timeline |
|----------|----------|
| Traditional Agency | 6-18 months |
| AI-Assisted (You) | ~2-4 weeks |

### What An Agency Would Charge for Maintenance
| Service | Monthly Cost |
|---------|-------------|
| Bug fixes | £500-2000 |
| Feature updates | £1000-5000 |
| Server management | £500-1000 |
| Security updates | £300-500 |
| **Total** | **£2300-8500/month** |

### Your Ongoing Costs (See Cost Document)
Approximately **£150-400/month** vs agency's £2300-8500/month

---

*Document Version 1.0 - February 2026*
