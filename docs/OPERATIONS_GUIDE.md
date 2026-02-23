# Radio Check - Operations & Maintenance Guide

## How to Look After This App

---

## SECTION 1: CAN ONE PERSON MANAGE THIS?

### Short Answer: Yes, BUT...

One person **can** manage this app for a small user base, but there are important considerations.

### What One Person Can Realistically Do

| Task | Time Required | Doable Solo? |
|------|---------------|--------------|
| Monitor app is running | 5 mins/day | ✅ Yes |
| Check error logs | 10 mins/day | ✅ Yes |
| Review safeguarding alerts | 15-30 mins/day | ⚠️ Depends on volume |
| Answer support emails | 30 mins/day | ✅ Yes |
| Update content (CMS) | 1-2 hrs/week | ✅ Yes |
| Manage staff accounts | 30 mins/week | ✅ Yes |
| Review analytics | 1 hr/week | ✅ Yes |
| Coordinate with counsellors | 2-3 hrs/week | ⚠️ Time-consuming |
| Handle complaints | As needed | ⚠️ Stressful alone |
| Emergency response | 24/7 availability | ❌ Not sustainable |

### The Honest Truth

- **0-100 users**: One person can manage with some stress
- **100-500 users**: One person will struggle, need help
- **500+ users**: Definitely need a small team

---

## SECTION 2: DAILY TASKS

### Essential Daily Checklist (15-30 minutes)

#### Morning Check (10 mins)
- [ ] Is the app accessible? (Open veteranv01.vercel.app)
- [ ] Is the backend running? (Check Render dashboard)
- [ ] Any error notifications? (Check email)
- [ ] Any urgent safeguarding alerts? (Admin portal)

#### Quick Commands to Check Health
```
# These would be run if you had server access
# Or check via the hosting dashboards

# Check Render: https://dashboard.render.com
# Check Vercel: https://vercel.com/dashboard
# Check MongoDB: https://cloud.mongodb.com
```

#### Evening Check (10 mins)
- [ ] Review any new safeguarding alerts
- [ ] Check callback queue cleared
- [ ] Review any user feedback/complaints
- [ ] Note any issues for tomorrow

### What To Look For

| Issue | Where to Check | Action |
|-------|---------------|--------|
| App not loading | Vercel dashboard | Check build logs |
| API errors | Render logs | Check error messages |
| Database issues | MongoDB Atlas | Check connection |
| Email not sending | Resend dashboard | Check quota/errors |
| High OpenAI costs | OpenAI dashboard | Review usage |

---

## SECTION 3: WEEKLY TASKS

### Weekly Checklist (2-3 hours total)

#### Monday - Review
- [ ] Review previous week's usage stats
- [ ] Check for any repeated errors
- [ ] Review safeguarding cases from weekend

#### Wednesday - Maintenance  
- [ ] Update any CMS content if needed
- [ ] Check staff shift coverage for coming week
- [ ] Review pending swap requests

#### Friday - Planning
- [ ] Backup check (is auto-backup working?)
- [ ] Cost review (OpenAI usage, hosting)
- [ ] Plan any updates needed
- [ ] Weekend coverage confirmed?

### Monthly Tasks (4-5 hours)

| Task | Time | Notes |
|------|------|-------|
| Full analytics review | 1 hr | User trends, popular features |
| Cost analysis | 30 mins | Are we on budget? |
| Staff performance review | 1 hr | With clinical supervisor |
| Security check | 30 mins | Any unusual access patterns? |
| Content audit | 1 hr | Is information up to date? |
| User feedback review | 1 hr | Patterns in complaints/praise |

---

## SECTION 4: SAFEGUARDING DUTIES

### This Is The Most Important Part

#### Daily Safeguarding Review
1. Log into Admin Portal
2. Go to "Compliance" or "Safeguarding" tab
3. Review ALL flagged alerts
4. Take action on each:
   - **Low**: Note reviewed, continue monitoring
   - **Medium**: Consider callback, document decision
   - **High**: Immediate action required

#### High-Risk Alert Response
1. **Immediate** (within 15 mins):
   - Review the flagged content
   - Attempt callback if user consented
   - If imminent risk, contact emergency services
   
2. **Within 1 hour**:
   - Document all actions taken
   - Notify clinical supervisor
   - Update safeguarding log

3. **Within 24 hours**:
   - Follow-up call if appropriate
   - Case review with supervisor
   - Update protocols if needed

#### Who Should Handle Safeguarding?

| Scenario | Handler |
|----------|---------|
| Low-risk flags | App admin (you) |
| Medium-risk | Trained peer supporter |
| High-risk | Clinical supervisor + you |
| Immediate danger | 999 + clinical supervisor |

**CRITICAL**: You should NOT be handling high-risk safeguarding alone without clinical supervision.

---

## SECTION 5: RECOMMENDED TEAM STRUCTURE

### Minimum Viable Team (100-500 users)

| Role | Hours/Week | Responsibility |
|------|------------|----------------|
| **You (Project Lead)** | 10-20 | Overall management, tech issues |
| **Clinical Supervisor** | 2-4 | Safeguarding oversight, staff support |
| **2-3 Peer Supporters** | 4-8 each | Callbacks, monitoring |

**Total cost**: £20,000-35,000/year (part-time roles)

### Growing Team (500-2000 users)

| Role | Hours/Week | Responsibility |
|------|------------|----------------|
| **Project Lead** | 20-30 | Full operations |
| **Clinical Lead** | 8-10 | All safeguarding, staff supervision |
| **Admin Support** | 10-15 | User queries, content |
| **4-6 Peer Supporters** | 8-12 each | Shift coverage |
| **1-2 Counsellors** | 8-16 each | Complex cases |

**Total cost**: £60,000-90,000/year

### Full Service Team (2000+ users)

| Role | FTE | Responsibility |
|------|-----|----------------|
| Service Manager | 1.0 | Overall leadership |
| Clinical Lead | 0.5 | Governance, supervision |
| Operations Coordinator | 1.0 | Day-to-day management |
| Admin/Support | 0.5 | User queries |
| 8-12 Peer Supporters | Various | Shift rota |
| 2-4 Counsellors | Various | Clinical support |
| Technical Support | 0.25 | Bug fixes, updates |

**Total cost**: £150,000-250,000/year

---

## SECTION 6: EMERGENCY PROCEDURES

### If The App Goes Down

#### Step 1: Don't Panic (5 mins)
- Check if it's just you (ask someone else to try)
- Check hosting status pages:
  - https://www.vercel-status.com
  - https://status.render.com
  - https://status.cloud.mongodb.com

#### Step 2: Identify the Problem (10 mins)
| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| White screen | Frontend issue | Vercel build logs |
| "Cannot connect" | Backend down | Render dashboard |
| Very slow | Database issue | MongoDB Atlas |
| Login fails | Auth issue | Backend logs |

#### Step 3: Quick Fixes
- **Vercel issue**: Redeploy from dashboard
- **Render issue**: Restart service from dashboard  
- **Database issue**: Check MongoDB connection string

#### Step 4: If You Can't Fix It
1. Post status update (if you have a status page/social)
2. Email/text your clinical supervisor
3. Contact Emergent support if build-related
4. Consider rollback to previous version

### If There's a Data Breach

1. **Immediate**: Document what you know
2. **Within 1 hour**: Assess scope, inform supervisor
3. **Within 24 hours**: 
   - Notify ICO if required (personal data of 1000+ people)
   - Notify affected users
4. **Within 72 hours**: Full ICO report if required

### If Someone Is In Immediate Danger

1. **DO**: Call 999 immediately
2. **DO**: Stay on line/chat with the person if safe
3. **DO**: Document everything
4. **DON'T**: Promise confidentiality over safety
5. **DON'T**: Try to handle alone
6. **AFTER**: Debrief with clinical supervisor

---

## SECTION 7: KNOWLEDGE YOU NEED

### Technical Skills (Can Learn)

| Skill | Importance | How to Learn |
|-------|------------|--------------|
| Checking hosting dashboards | Essential | Practice, documentation |
| Reading error logs | Helpful | YouTube tutorials |
| Basic troubleshooting | Helpful | Trial and error |
| Updating CMS content | Essential | Built-in, easy |
| Managing user accounts | Essential | Built-in, easy |

### Non-Technical Skills (Essential)

| Skill | Why | How to Develop |
|-------|-----|----------------|
| Safeguarding awareness | Legal requirement | Training course (1 day) |
| Mental health first aid | User safety | MHFA course (2 days) |
| Basic counselling skills | User interactions | Short course or shadowing |
| Incident documentation | Legal protection | Templates provided |
| Boundary setting | Self-protection | Supervision |

### Recommended Training For You

| Training | Duration | Cost | Provider |
|----------|----------|------|----------|
| Safeguarding Adults | 1 day | £50-100 | Local authority |
| Mental Health First Aid | 2 days | £200-300 | MHFA England |
| Suicide Awareness | Half day | £50-100 | Various |
| Data Protection | Online | £0-50 | ICO website |

---

## SECTION 8: WHEN TO GET HELP

### Technical Issues

| Issue | DIY or Get Help? |
|-------|------------------|
| App won't load | Try restart first, then get help |
| Minor bugs | Note for future, not urgent |
| Data not saving | Get help |
| Security concern | GET HELP IMMEDIATELY |
| New feature needed | Get help (Emergent or developer) |

### Clinical Issues

| Issue | Who to Contact |
|-------|----------------|
| Unsure about safeguarding decision | Clinical supervisor |
| Complex mental health presentation | Counsellor/supervisor |
| Complaint about staff | Clinical supervisor |
| Complaint about you | External advice |
| Legal threat | Seek legal advice |

### Burnout Warning Signs

If you're experiencing:
- Dreading checking the app
- Losing sleep over user issues
- Taking user problems personally
- Feeling alone and unsupported
- Physical symptoms (headaches, fatigue)

**STOP and get support**:
- Talk to your supervisor
- Set boundaries on hours
- Consider adding team members
- Take time off if needed

---

## SECTION 9: DOCUMENTATION TO MAINTAIN

### Essential Records

| Document | Update Frequency | Location |
|----------|-----------------|----------|
| Safeguarding log | Each incident | Admin portal |
| Staff records | When changed | Admin portal |
| Incident reports | Each incident | Your records |
| Complaints log | Each complaint | Your records |
| Training records | When completed | Your records |

### Monthly Reports (For Funders/Board)

| Report | Contents |
|--------|----------|
| Usage statistics | Users, chats, calls |
| Safeguarding summary | Cases, outcomes |
| Financial summary | Costs vs budget |
| Staff summary | Hours, training |
| Issues/risks | Any concerns |

---

## SECTION 10: YOUR SELF-CARE

### You Cannot Pour From An Empty Cup

#### Set Boundaries
- Specific "office hours" for app management
- Phone on silent outside hours (have emergency contact)
- Regular days completely off

#### Get Support
- Monthly supervision (even informal)
- Peer support from other charity workers
- Professional support if needed

#### Recognise Limits
- This is meaningful work, but you are not 999
- You cannot save everyone
- Looking after yourself IS looking after the service

---

## QUICK REFERENCE CARD

### Daily (15 mins)
- [ ] App running?
- [ ] Safeguarding alerts reviewed?
- [ ] Any urgent emails?

### Weekly (2 hrs)  
- [ ] Analytics reviewed
- [ ] Staff coverage confirmed
- [ ] CMS content current

### Monthly (4 hrs)
- [ ] Full analytics review
- [ ] Cost check
- [ ] Supervision session
- [ ] Security review

### Emergency Contacts
- Clinical Supervisor: [Add number]
- Technical Help: [Emergent support]
- Safeguarding Lead: [Add number]
- Your backup person: [Add number]

---

*Document Version 1.0 - February 2026*
*Review this document every 6 months*
