# Radio Check - Governance Operations Guide

## Overview

This document explains how the Clinical Safety Governance system works and what actions are required from each team member to maintain compliance.

---

## Who Needs To Do What?

### Quick Reference Table

| Role | Required Actions | Frequency |
|------|-----------------|-----------|
| **Clinical Safety Officer (CSO)** | Review hazards, approve changes, sign-off | Monthly + as needed |
| **Admin** | Monitor KPIs, manage incidents, export audits | Weekly |
| **Staff/Counsellors** | Respond to alerts, acknowledge safeguarding events | Real-time |
| **Peers** | Report concerns, follow behaviour standards | As needed |

---

## 1. Hazard Register

### What It Is
A formal log of identified risks to user safety, with severity ratings and mitigation strategies.

### How It Works
1. **Pre-populated hazards** - The system comes with 7 core hazards already defined (H1-H7)
2. **Risk calculation** - Each hazard has Severity × Likelihood = Risk Rating (1-25)
3. **Status tracking** - Hazards can be Active, Mitigated, Under Review, or Closed

### Who Does What?

| Action | Who | How Often |
|--------|-----|-----------|
| Review hazards | CSO | Monthly |
| Add new hazards | CSO/Admin | When identified |
| Update status | CSO | After mitigation implemented |
| Approve closures | CSO | Before closing any hazard |

### How To Use (Admin Portal)
1. Go to **Governance** tab
2. Click **Hazard Register**
3. View all hazards with risk ratings
4. Click **Review** button to mark as reviewed
5. Use **Add Hazard** to log new risks

### ⚠️ CSO Input Required
- **Monthly review** of all active hazards
- **Sign-off** before any hazard can be closed
- **Approval** before risk thresholds are changed

---

## 2. Safeguarding KPIs

### What It Is
Performance metrics tracking how quickly and effectively the team responds to safeguarding alerts.

### How It Works
1. **Automatic tracking** - System logs all alert timestamps and responses
2. **Target comparison** - Metrics compared against NHS-aligned targets
3. **Trend analysis** - View performance over 7/30/90 day periods

### Key Metrics Tracked

| KPI | Target | What It Measures |
|-----|--------|-----------------|
| High-risk response time | < 15 mins | Time from alert to staff acknowledgement |
| Imminent risk response | < 5 mins | Time to contact user in crisis |
| SLA compliance | > 90% | % of cases handled within targets |
| False positive rate | < 15% | Alerts that weren't genuine risks |

### Who Does What?

| Action | Who | How Often |
|--------|-----|-----------|
| Monitor dashboard | Admin | Weekly |
| Review trends | CSO | Monthly |
| Investigate breaches | Admin/CSO | When targets missed |

### How To Use
1. Go to **Governance** > **Safeguarding KPIs**
2. Select time period (7/30/90 days)
3. Review metrics against targets
4. Export for governance meetings

### ⚠️ No Manual Input Required
KPIs are calculated automatically from system data. However:
- **Staff must acknowledge alerts** for response times to be recorded
- **Admin should review weekly** to spot concerning trends

---

## 3. Incident Management

### What It Is
Formal logging and tracking of safety incidents for investigation and learning.

### How It Works
1. **Incident creation** - Can be auto-triggered or manually created
2. **Severity levels** - Level 1 (Moderate), Level 2 (High), Level 3 (Critical)
3. **Investigation workflow** - Open → Investigating → Resolved → Closed
4. **Audit trail** - All actions logged with timestamps

### When To Create An Incident

| Situation | Level | Example |
|-----------|-------|---------|
| User expressed distress, staff responded | Level 1 | Medium-risk alert handled successfully |
| User in crisis, required escalation | Level 2 | Called emergency services |
| Serious safeguarding concern | Level 3 | User disclosed abuse, external referral made |
| System failure during support | Level 2 | Platform down when user needed help |
| Near-miss (something almost went wrong) | Level 1 | Alert nearly missed but caught in time |

### Who Does What?

| Action | Who | How Often |
|--------|-----|-----------|
| Create incidents | Admin/Staff | When events occur |
| Investigate | Assigned staff | Within 24-48 hours |
| Close incidents | Admin | After resolution |
| Review patterns | CSO | Monthly |

### How To Use
1. Go to **Governance** > **Incident Management**
2. Click **New Incident**
3. Fill in: Title, Description, Level
4. Assign to staff member
5. Update with investigation findings
6. Close when resolved

### ⚠️ Staff/Counsellor Input Required
- **Report significant events** even if handled well (for learning)
- **Document what happened** and what was done
- **Flag patterns** you notice

---

## 4. Peer Moderation

### What It Is
System for managing reports about peer behaviour in the buddy matching system.

### How It Works
1. **Users report** - Any user can report concerning peer behaviour
2. **Queue created** - Reports appear in moderation queue
3. **Staff review** - Staff decide on action
4. **Actions logged** - All decisions recorded for audit

### Report Reasons

| Reason | Action Options |
|--------|---------------|
| Harassment | Warning / Suspension / Ban |
| Encouraging self-harm | Immediate suspension + incident |
| Threatening behaviour | Suspension / Ban |
| Inappropriate content | Warning / Suspension |
| Suspected grooming | Ban + external referral |

### Who Does What?

| Action | Who | How Often |
|--------|-----|-----------|
| Submit reports | Users/Peers | When needed |
| Review queue | Admin/Staff | Daily check |
| Take action | Admin | Within 24 hours |
| Review bans | CSO | Monthly |

### How To Use
1. Go to **Governance** > **Peer Moderation**
2. View pending reports
3. Click action buttons:
   - ✓ **Reviewed** - No action needed
   - ⚠️ **Warning** - Issue warning to user
   - 🚫 **Suspend** - Temporary block
4. Add notes explaining decision

### ⚠️ Peer Input
Peers need to understand:
- **Behaviour standards** - What's acceptable
- **How to report** - Button available on peer messages
- **Consequences** - Warning → Suspension → Ban

---

## 5. CSO Approvals

### What It Is
Workflow ensuring clinical oversight before safety-critical changes are made.

### What Requires CSO Approval?

| Change Type | Example |
|-------------|---------|
| Risk threshold changes | Lowering the score that triggers alerts |
| Trigger word updates | Adding/removing crisis keywords |
| Escalation rule changes | Modifying when staff are notified |
| Hazard closures | Marking a hazard as no longer relevant |
| Annual safeguarding sign-off | Yearly confirmation system is safe |

### How It Works
1. **Request submitted** - Admin proposes a change
2. **CSO notified** - Appears in approval queue
3. **CSO reviews** - Checks change is safe
4. **Approval/Denial** - Decision logged with notes
5. **Change applied** - Only if approved

### Who Does What?

| Action | Who | How Often |
|--------|-----|-----------|
| Submit requests | Admin | When changes needed |
| Review requests | CSO | Within 48 hours |
| Annual sign-off | CSO | Yearly |

### How To Use
1. Go to **Governance** > **CSO Approvals**
2. View pending requests
3. Click **Approve** or **Deny**
4. Add review notes
5. For annual sign-off, use the **CSO Sign-off** section at bottom

### ⚠️ CSO Input Required
- **Must have qualified CSO** - RMN, Psychologist, or Counsellor Level 4+
- **Must review within 48 hours** - Safety changes shouldn't wait
- **Must sign off annually** - Confirms system reviewed

---

## 6. Audit Export

### What It Is
Downloadable governance data for compliance reporting and DPIA.

### What's Included

| Data | Description |
|------|-------------|
| Hazard log | All hazards with history |
| KPI metrics | Performance data for period |
| Incidents | All logged incidents |
| Audit trail | All governance actions |

### What's NOT Included (Privacy)
- ❌ Chat message content
- ❌ User personal details
- ❌ Date of birth information

### Who Does What?

| Action | Who | How Often |
|--------|-----|-----------|
| Export data | Admin | Monthly / as needed |
| Review for board | CSO | Quarterly |
| Submit to funders | Admin | As required |

### How To Use
1. Go to **Governance** > **Hazard Register**
2. Click **Export** button
3. Select period (default 90 days)
4. JSON file downloads automatically

---

## Checklist: What Each Role Must Do

### Clinical Safety Officer (CSO)

**Monthly:**
- [ ] Review all active hazards in Hazard Register
- [ ] Review safeguarding KPIs
- [ ] Review any pending incidents
- [ ] Check moderation actions taken
- [ ] Sign off any pending approvals

**Annually:**
- [ ] Complete annual safeguarding sign-off
- [ ] Review and update hazard log
- [ ] Prepare governance report for board

### Admin

**Daily:**
- [ ] Check peer moderation queue
- [ ] Monitor for new incidents

**Weekly:**
- [ ] Review KPI dashboard
- [ ] Check for trends/concerns
- [ ] Follow up on open incidents

**Monthly:**
- [ ] Export governance data
- [ ] Prepare CSO review pack

### Staff/Counsellors

**Real-time:**
- [ ] Acknowledge safeguarding alerts promptly
- [ ] Document crisis interventions
- [ ] Report significant events as incidents

**As needed:**
- [ ] Review moderation reports assigned to you
- [ ] Flag concerns to Admin/CSO

### Peers (Buddy Supporters)

**Ongoing:**
- [ ] Follow behaviour standards
- [ ] Report concerning behaviour from other peers
- [ ] Respond to any warnings received

---

## Getting Started Checklist

### Immediate (Before Go-Live)

1. [ ] **Appoint a CSO** - Must have clinical qualification
2. [ ] **CSO reviews default hazards** - Confirm H1-H7 are appropriate
3. [ ] **Test alert response** - Staff practice acknowledging alerts
4. [ ] **Peer briefing** - Explain behaviour standards

### First Month

5. [ ] **Weekly KPI review** - Establish baseline
6. [ ] **First incident drill** - Practice logging an incident
7. [ ] **Export first audit** - Test the process
8. [ ] **CSO sign-off** - Initial confirmation

### Ongoing

9. [ ] **Monthly CSO review** - Calendar reminder
10. [ ] **Quarterly board report** - From exported data
11. [ ] **Annual review** - Full system assessment

---

## Contact & Escalation

**For technical issues:** admin@radiocheck.me

**For clinical concerns:** [CSO Email - To be assigned]

**For safeguarding emergencies:** Follow standard safeguarding escalation procedures

---

*Document Version: 1.0*
*Last Updated: December 2025*
*Review Date: March 2026*
