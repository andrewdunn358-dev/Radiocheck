# Radio Check Admin Portal - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Staff Management](#staff-management)
3. [Rota Management](#rota-management)
4. [CMS (Content Management)](#cms-content-management)
5. [AI Personas](#ai-personas)
6. [Beta Testing](#beta-testing)
7. [Compliance](#compliance)
8. [Logs](#logs)
9. [Monitoring](#monitoring)
10. [Governance](#governance)
11. [Events](#events)
12. [AI Learning](#ai-learning)
13. [Time Tracking](#time-tracking)
14. [AI Usage](#ai-usage)
15. [Migration](#migration)
16. [Settings](#settings)

---

## Getting Started

### Logging In
1. Navigate to the Admin Portal URL (`/admin`)
2. Enter your admin email address and password
3. **Remember Me**: Check this box on personal devices to stay logged in
4. Click **Sign In**

### Navigation
- Use the sidebar to navigate between tabs
- Click the **Menu** icon to collapse/expand the sidebar
- The alert badge in the header shows pending safeguarding alerts

### Alert Notifications
The bell icon in the header displays the count of pending alerts. Click to navigate to the Monitoring tab.

---

## Staff Management

### Overview
Manage all staff members including counsellors, peer supporters, and administrators.

### Viewing Staff
- All staff are listed with their name, email, role, and status
- Use filters to view specific roles or statuses

### Adding New Staff
1. Click **Add Staff** button
2. Fill in required fields:
   - **Name**: Full name
   - **Email**: Login email address
   - **Role**: Select from Counsellor, Peer Supporter, Admin
   - **Phone** (optional): Contact number
3. Click **Create**

### Editing Staff
1. Click on a staff member's row
2. Modify the required fields
3. Click **Save Changes**

### Staff Roles
| Role | Permissions |
|------|-------------|
| **Admin** | Full access to admin portal |
| **Counsellor** | Handle safeguarding, calls, chats, supervision |
| **Peer Supporter** | Basic chat and callback support |

### Deactivating Staff
1. Select the staff member
2. Change status to **Inactive**
3. They will no longer be able to log in

---

## Rota Management

### Calendar Overview
View and manage staff shifts across your organisation.

### Creating Shifts
1. Navigate to **Rota** tab
2. Click **Add Shift**
3. Select:
   - Staff member
   - Date
   - Start time
   - End time
   - Shift type
4. Click **Save**

### Shift Types
- **Morning**: 06:00 - 14:00
- **Afternoon**: 14:00 - 22:00
- **Evening**: 18:00 - 02:00
- **Night**: 22:00 - 06:00

### Managing Swap Requests
Staff can request shift swaps:
1. Review pending swap requests
2. Click **Approve** or **Reject**
3. Both staff members are notified

### Bulk Scheduling
For recurring shifts:
1. Click **Bulk Schedule**
2. Select staff member(s)
3. Choose date range
4. Set the recurring pattern
5. Click **Generate Shifts**

---

## CMS (Content Management)

### Overview
Manage the content displayed in the veteran-facing mobile app.

### Content Types
- **Welcome Messages**: Greeting text for new users
- **FAQ Items**: Frequently asked questions
- **Resource Links**: Helpful external resources
- **Crisis Information**: Emergency contact details

### Editing Content
1. Select the content item
2. Modify the text in the editor
3. Preview changes
4. Click **Publish**

### Content Scheduling
Schedule content to appear at specific times:
1. Edit the content item
2. Set **Publish Date** and **Expiry Date**
3. Save changes

---

## AI Personas

### Overview
Configure the AI companion personalities that interact with veterans.

### Persona Settings
Each persona can be configured with:
- **Name**: Display name
- **Tone**: Professional, Friendly, Casual, Empathetic
- **Response Style**: Concise, Detailed, Conversational
- **Crisis Protocols**: How to handle safeguarding triggers

### Creating a New Persona
1. Click **Add Persona**
2. Configure the personality traits
3. Set the system prompt template
4. Test the persona in sandbox mode
5. Click **Activate**

### Testing Personas
Use the sandbox to test persona responses:
1. Select a persona
2. Enter test messages
3. Review AI responses
4. Adjust settings as needed

---

## Beta Testing

### Overview
Manage beta features and test user groups.

### Feature Flags
Enable or disable experimental features:
1. View the feature list
2. Toggle features on/off
3. Set percentage rollout (e.g., 10% of users)

### Beta Testers
Manage users enrolled in beta testing:
1. Click **Add Tester**
2. Enter user email
3. Select features to enable
4. Send invitation

### Feedback Collection
Review feedback from beta testers:
- View ratings and comments
- Export feedback reports
- Track feature requests

---

## Compliance

### Overview
Monitor and manage regulatory compliance.

### Audit Reports
Generate compliance reports:
1. Select report type (GDPR, Data Retention, etc.)
2. Set date range
3. Click **Generate**
4. Download PDF or view online

### Data Retention
Configure automatic data deletion:
- **Chat Transcripts**: Default 7 years
- **User Data**: Configurable per regulation
- **Audit Logs**: Minimum 3 years

### GDPR Requests
Handle data subject requests:
1. View pending requests
2. Process data exports
3. Execute deletion requests
4. Document completion

---

## Logs

### Overview
View system and user activity logs.

### Log Types
- **Authentication**: Login/logout events
- **Staff Actions**: Changes made by staff
- **System Events**: Automated processes
- **API Activity**: External integrations
- **Safeguarding**: Alert triggers and responses

### Filtering Logs
1. Select log type
2. Set date range
3. Filter by user or action
4. Click **Apply**

### Exporting Logs
1. Apply desired filters
2. Click **Export**
3. Select format (CSV, JSON)
4. Download file

---

## Monitoring

### Real-time Dashboard
Monitor system health and activity:

### Key Metrics
- **Active Users**: Currently connected veterans
- **Staff Online**: Available staff members
- **Active Chats**: Ongoing support sessions
- **Response Time**: Average wait time

### Alerts Panel
View and manage safeguarding alerts:
- Filter by status (Active/Acknowledged/Resolved)
- Filter by risk level
- Assign to staff members

### System Health
Monitor technical status:
- API response times
- Database connectivity
- Third-party service status

---

## Governance

### Overview
Manage organisational policies and procedures.

### Policy Documents
Upload and manage policy files:
1. Click **Upload Policy**
2. Select document type
3. Set review date
4. Upload file

### Review Schedule
Track policy review deadlines:
- Overdue reviews highlighted in red
- Upcoming reviews in yellow
- Completed reviews in green

### Incident Records
Document and track governance incidents:
1. Click **Log Incident**
2. Complete incident form
3. Assign follow-up actions
4. Track to resolution

---

## Events

### Overview
Manage community events for veterans, including virtual events with live video.

### Event Types
- **In-Person**: Physical location events
- **Virtual**: Online events via Jitsi Meet
- **Hybrid**: Both in-person and online

### Creating Events
1. Click **Add Event**
2. Fill in details:
   - Title
   - Description
   - Date and time
   - Location (physical or virtual)
   - Event type
3. Click **Create**

### Virtual Events (Jitsi Integration)
For virtual or hybrid events:
- A "Join" button appears when the event is live
- Veterans can join directly without a Jitsi account
- No lobby or waiting room - instant access
- Staff can monitor participant counts

### Event Status Indicators
- **Live** (Green badge): Event is currently active
- **Upcoming**: Shows countdown/date
- **Past**: Event has ended

### Joining Virtual Events
1. When an event goes live, a green "Live" badge appears
2. Click **Join** to open the video room
3. Your audio is muted by default
4. Use controls to mute/unmute, toggle video, chat
5. Click **Leave** when finished

---

## AI Learning

### Overview
Review and improve AI model performance.

### Conversation Review
Audit AI conversations for quality:
1. Browse recent conversations
2. Rate response quality
3. Flag inappropriate responses
4. Submit corrections

### Training Data
Manage training examples:
1. Add new example conversations
2. Mark good/bad responses
3. Submit for model retraining

### Performance Metrics
Monitor AI effectiveness:
- Response accuracy rates
- User satisfaction scores
- Safeguarding detection rates

---

## Time Tracking

### Overview
Monitor and manage staff working hours.

### Timesheets
View staff time records:
- Daily/weekly/monthly views
- Hours worked vs. scheduled
- Overtime tracking

### Reports
Generate time reports:
1. Select date range
2. Choose staff (individual or all)
3. Select report format
4. Download or view online

### Approvals
Review and approve timesheets:
1. View pending submissions
2. Check for discrepancies
3. Approve or request corrections

---

## AI Usage

### Overview
Monitor AI API usage and costs.

### Usage Dashboard
Track consumption metrics:
- Total API calls
- Token usage
- Cost by feature
- Daily/monthly trends

### Cost Allocation
View costs by:
- Department
- Feature
- Time period

### Alerts
Set usage alerts:
1. Click **Add Alert**
2. Set threshold (cost or volume)
3. Configure notification recipients

### Budgets
Manage AI spending:
1. Set monthly budget
2. Track actual vs. budget
3. Receive warnings at thresholds

---

## Migration

### Overview
Tools for data import/export and system migration.

### Data Export
Export data for backup or migration:
1. Select data types
2. Set filters (date range, etc.)
3. Choose format
4. Start export

### Data Import
Import data from other systems:
1. Click **Import**
2. Upload file
3. Map fields
4. Preview data
5. Confirm import

### Migration Status
Track ongoing migrations:
- Progress indicators
- Error logs
- Completion status

---

## Settings

### Organisation Settings
Configure organisation-wide settings:
- Organisation name
- Contact details
- Branding (logo, colours)

### Security Settings
- Password policies
- Session timeout duration
- Two-factor authentication

### Integration Settings
Configure third-party integrations:
- Twilio (phone calls)
- Email provider
- Analytics

### Notification Settings
Configure system notifications:
- Email alerts
- In-app notifications
- Alert thresholds

---

## Quick Reference

### User Roles Summary
| Role | Staff | Rota | CMS | AI | Logs | Settings |
|------|-------|------|-----|----|----- |----------|
| Super Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | Limited |
| Manager | ✓ | ✓ | View | View | View | ✗ |

### Keyboard Shortcuts
- **Ctrl/Cmd + S**: Save current form
- **Escape**: Close modal
- **Tab**: Navigate form fields

### Support
For technical issues or questions:
- Email: admin-support@radiocheck.org
- Internal ticket system

---

*Last Updated: December 2025*
*Version: 2.0*
