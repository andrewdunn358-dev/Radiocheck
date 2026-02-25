# Radio Check
## Technical Overview

---

## 1. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   Mobile App    │  Staff Portal   │        Admin Portal             │
│  (React Native) │  (Static HTML)  │       (Static HTML)             │
│   Vercel CDN    │    20i Host     │         20i Host                │
└────────┬────────┴────────┬────────┴────────────┬────────────────────┘
         │                 │                      │
         └─────────────────┼──────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
│                    FastAPI Backend                                   │
│                   (Render Hosting)                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Authentication │ Rate Limiting │ CORS │ Request Validation  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     API Routers                               │   │
│  │  auth │ cms │ shifts │ callbacks │ live_chat │ safeguarding  │   │
│  │  surveys │ buddy_finder │ concerns │ resources │ podcasts    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   MongoDB       │ │   OpenAI API    │ │   Resend API    │
│   Atlas         │ │   (GPT-4)       │ │   (Email)       │
│   Database      │ │   AI Chat       │ │   Notifications │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Frontend | React Native (Expo) | SDK 52 | Cross-platform web app |
| Backend | Python FastAPI | 0.100+ | High-performance async API |
| Database | MongoDB | 6.0+ | Document database |
| AI | OpenAI GPT-4 | Latest | Chat companions |
| Email | Resend | Latest | Transactional email |
| Real-time | Socket.IO | 5.x | WebSocket connections |
| Auth | JWT | - | Token-based authentication |

---

## 2. Backend Architecture

### Project Structure

```
/backend
├── server.py              # Main FastAPI application
├── safety.py              # AI safeguarding module
├── encryption.py          # Field-level encryption
├── cron_runner.py         # Scheduled task runner
├── requirements.txt       # Python dependencies
├── .env                   # Environment configuration
│
├── /routers               # API route modules
│   ├── auth.py            # Authentication endpoints
│   ├── cms.py             # Content management
│   ├── shifts.py          # Staff rota management
│   ├── shift_swaps.py     # Shift swap requests
│   ├── callbacks.py       # Callback request handling
│   ├── live_chat.py       # Real-time chat (Socket.IO)
│   ├── safeguarding.py    # Risk alerts & screening
│   ├── surveys.py         # Beta feedback system
│   ├── buddy_finder.py    # Peer matching
│   ├── concerns.py        # Family concern reports
│   ├── resources.py       # Resource library
│   ├── podcasts.py        # Podcast management
│   ├── notes.py           # Staff notes
│   ├── staff.py           # Staff management
│   ├── organizations.py   # Support organisations
│   ├── compliance.py      # Compliance documents
│   ├── data_retention.py  # GDPR data retention
│   └── knowledge_base.py  # AI knowledge base
│
└── /models                # Pydantic data models
    └── survey.py          # Survey response models
```

### Core Modules

**server.py** - Main Application
- FastAPI app initialisation
- CORS middleware configuration
- Rate limiting implementation
- JWT authentication
- AI character definitions (7 personas)
- Core CRUD endpoints

**safety.py** - AI Safeguarding
- Risk keyword detection
- Severity scoring (GREEN/YELLOW/AMBER/RED)
- Crisis resource injection
- Conversation monitoring

**encryption.py** - Data Security
- Field-level AES encryption
- Encrypted fields: phone, email, name
- Automatic encrypt/decrypt on DB operations

---

## 3. API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login, returns JWT |
| POST | `/api/auth/register` | Create new user account |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/auth/users` | List all users (admin) |
| DELETE | `/api/auth/users/{id}` | Delete user (admin) |
| POST | `/api/auth/change-password` | Change own password |
| POST | `/api/auth/reset-password-request` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/admin-reset-password` | Admin reset user password |

### Staff Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/counsellors` | List all counsellors |
| POST | `/api/counsellors` | Create counsellor |
| GET | `/api/counsellors/{id}` | Get counsellor details |
| PUT | `/api/counsellors/{id}` | Update counsellor |
| PATCH | `/api/counsellors/{id}/status` | Update availability |
| DELETE | `/api/counsellors/{id}` | Remove counsellor |
| GET | `/api/peer-supporters` | List peer supporters |
| POST | `/api/peer-supporters` | Create peer supporter |
| PATCH | `/api/peer-supporters/{id}/status` | Update availability |

### Shift Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shifts` | List shifts (filterable) |
| POST | `/api/shifts` | Create new shift |
| PUT | `/api/shifts/{id}` | Update shift |
| DELETE | `/api/shifts/{id}` | Cancel shift |
| GET | `/api/shifts/my-shifts` | Get user's shifts |
| GET | `/api/shifts/today` | Today's scheduled shifts |
| POST | `/api/shift-swaps` | Request shift swap |
| PATCH | `/api/shift-swaps/{id}/accept` | Accept swap request |
| PATCH | `/api/shift-swaps/{id}/approve` | Admin approve swap |

### Callback System

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/callbacks` | Create callback request |
| GET | `/api/callbacks` | List all callbacks |
| PATCH | `/api/callbacks/{id}/take` | Claim callback |
| PATCH | `/api/callbacks/{id}/release` | Release callback |
| PATCH | `/api/callbacks/{id}/complete` | Mark completed |

### AI Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Send message to AI |
| GET | `/api/ai/characters` | List AI characters |
| POST | `/api/ai-feedback` | Submit chat feedback |

### Content Management (CMS)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cms/pages` | List CMS pages |
| GET | `/api/cms/pages/{slug}` | Get page with sections |
| POST | `/api/cms/pages` | Create page |
| PUT | `/api/cms/pages/{id}` | Update page |
| POST | `/api/cms/sections` | Create section |
| PUT | `/api/cms/sections/{id}` | Update section |
| POST | `/api/cms/cards` | Create card |
| PUT | `/api/cms/cards/{id}` | Update card |
| POST | `/api/cms/seed-public` | Seed default content |

### Surveys & Feedback

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/surveys/response` | Submit survey response |
| GET | `/api/surveys/stats` | Get survey statistics |
| GET | `/api/surveys/responses` | List all responses |
| GET | `/api/surveys/export` | Export CSV data |
| GET | `/api/settings/{key}` | Get setting value |
| POST | `/api/settings` | Update setting |

### Safeguarding

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/safeguarding-alerts` | List alerts |
| PATCH | `/api/safeguarding-alerts/{id}/acknowledge` | Acknowledge alert |
| PATCH | `/api/safeguarding-alerts/{id}/resolve` | Resolve alert |
| POST | `/api/panic-alert` | Trigger panic alert |
| GET | `/api/panic-alerts` | List panic alerts |

### Live Chat (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client→Server | Join chat room |
| `leave_room` | Client→Server | Leave chat room |
| `message` | Bidirectional | Send/receive message |
| `typing` | Bidirectional | Typing indicator |
| `user_joined` | Server→Client | User joined notification |
| `user_left` | Server→Client | User left notification |

---

## 4. Database Schema

### Collections

**users**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  email: String (encrypted),
  password_hash: String,
  name: String (encrypted),
  role: "admin" | "counsellor" | "peer",
  created_at: DateTime,
  last_login: DateTime
}
```

**counsellors**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  name: String,
  specialization: String,
  phone: String (encrypted),
  sms: String (encrypted),
  whatsapp: String (encrypted),
  status: "available" | "busy" | "off",
  user_id: String (links to users),
  sip_extension: String,
  created_at: DateTime
}
```

**peer_supporters**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  firstName: String,
  area: String,
  background: String,
  yearsServed: String,
  phone: String (encrypted),
  status: "available" | "limited" | "unavailable",
  user_id: String,
  created_at: DateTime
}
```

**shifts**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  staff_id: String,
  staff_name: String,
  staff_role: "peer" | "counsellor",
  date: String (YYYY-MM-DD),
  start_time: String (HH:MM),
  end_time: String (HH:MM),
  status: "scheduled" | "active" | "completed" | "cancelled",
  notes: String,
  created_at: DateTime
}
```

**callbacks**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  name: String (encrypted),
  phone: String (encrypted),
  email: String (encrypted),
  message: String,
  request_type: "counsellor" | "peer",
  status: "pending" | "in_progress" | "completed" | "released",
  assigned_to: String,
  assigned_name: String,
  is_urgent: Boolean,
  created_at: DateTime,
  updated_at: DateTime
}
```

**safeguarding_alerts**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  session_id: String,
  character: String,
  triggering_message: String,
  ai_response: String,
  risk_level: "GREEN" | "YELLOW" | "AMBER" | "RED",
  risk_score: Number,
  triggered_indicators: [String],
  status: "active" | "acknowledged" | "resolved",
  client_ip: String,
  geo_city: String,
  geo_country: String,
  conversation_history: [Object],
  created_at: DateTime
}
```

**cms_pages**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  slug: String,
  title: String,
  description: String,
  icon: String,
  is_visible: Boolean,
  show_in_nav: Boolean,
  nav_order: Number,
  created_at: DateTime,
  updated_at: DateTime
}
```

**cms_sections**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  page_slug: String,
  section_type: "hero" | "cards" | "text" | "ai_team" | "resources",
  title: String,
  subtitle: String,
  content: String,
  order: Number,
  is_visible: Boolean,
  settings: Object,
  created_at: DateTime
}
```

**cms_cards**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  section_id: String,
  card_type: "ai_character" | "tool" | "resource" | "link",
  title: String,
  description: String,
  icon: String,
  image_url: String,
  color: String,
  bg_color: String,
  route: String,
  external_url: String,
  order: Number,
  is_visible: Boolean,
  metadata: Object,
  created_at: DateTime
}
```

**survey_responses**
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  user_id: String,
  type: "pre" | "post",
  wellbeing: Number (1-10),
  feedback: String,
  nps: Number (0-10),
  timestamp: DateTime
}
```

**settings**
```javascript
{
  _id: ObjectId,
  key: String,
  value: Any,
  updated_at: DateTime
}
```

---

## 5. Security Implementation

### Authentication Flow

```
1. User submits credentials
   POST /api/auth/login { email, password }
   
2. Server validates credentials
   - Lookup user by email
   - Verify password hash (bcrypt)
   
3. Generate JWT token
   - Payload: { user_id, email, role, exp }
   - Sign with JWT_SECRET_KEY
   - Expiry: 24 hours
   
4. Return token to client
   { token: "eyJ...", user: {...} }
   
5. Client stores token
   - localStorage (web)
   - SecureStore (mobile)
   
6. Subsequent requests include token
   Authorization: Bearer eyJ...
```

### Rate Limiting

```python
RATE_LIMIT_REQUESTS = 20    # Max requests per window
RATE_LIMIT_WINDOW = 60      # Window in seconds
RATE_LIMIT_BURST = 5        # Max burst requests (5 sec)
SESSION_RATE_LIMIT = 50     # Max AI messages per session

# Implementation
- Track requests per IP
- Burst detection (5 requests in 5 seconds)
- Automatic IP blocking (5 minutes)
- Session-level limits for AI chat
```

### Field Encryption

```python
ENCRYPTED_FIELDS = ['phone', 'email', 'name', 'sms', 'whatsapp']

# AES-256-GCM encryption
- Encrypt on write to database
- Decrypt on read from database
- Key stored in environment variable
```

### CORS Configuration

```python
origins = [
    "https://app.radiocheck.me",
    "https://admin.radiocheck.me",
    "https://staff.radiocheck.me",
    "http://localhost:3000",
    "http://localhost:19006"
]
```

---

## 6. AI Integration

### Character System

7 AI personas with specialised system prompts:

| Character | Focus | Prompt Size |
|-----------|-------|-------------|
| Tommy | General peer support | ~3000 tokens |
| Doris | Emotional support | ~3000 tokens |
| Bob | Para veteran | ~2500 tokens |
| Finch | Legal information | ~2000 tokens |
| Margie | Addiction support | ~2500 tokens |
| Hugo | Wellbeing coach | ~2000 tokens |
| Rita | Family support | ~2000 tokens |

### Safety Monitor

```python
# Risk levels
GREEN  = No concern detected
YELLOW = Mild distress indicators
AMBER  = Moderate risk, needs attention
RED    = High risk, immediate concern

# Detection triggers
- Suicide/self-harm keywords
- Hopelessness indicators
- Isolation language
- Crisis escalation patterns

# Response injection
- Append crisis resources
- Create safeguarding alert
- Capture geolocation data
```

### API Integration

```python
# OpenAI configuration
client = OpenAI(api_key=OPENAI_API_KEY)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": character_prompt},
        {"role": "user", "content": user_message}
    ],
    max_tokens=500,
    temperature=0.7
)
```

---

## 7. Deployment

### Infrastructure

| Service | Platform | Purpose |
|---------|----------|---------|
| Mobile App | Vercel | Frontend hosting, CDN |
| Backend API | Render | Python app hosting |
| Admin Portal | 20i | Static site hosting |
| Staff Portal | 20i | Static site hosting |
| Database | MongoDB Atlas | Managed database |

### Environment Variables

**Backend (.env)**
```
MONGO_URL=mongodb+srv://...
DB_NAME=veterans_support
JWT_SECRET_KEY=...
OPENAI_API_KEY=...
RESEND_API_KEY=...
ENCRYPTION_KEY=...
```

**Frontend (.env)**
```
REACT_APP_BACKEND_URL=https://veterans-support-api.onrender.com
```

### Deployment Process

**Vercel (Frontend)**
```bash
# Automatic deployment on git push
# Deploy hook available for manual triggers
POST https://api.vercel.com/v1/integrations/deploy/...
```

**Render (Backend)**
```bash
# Auto-deploy from main branch
# Build command: pip install -r requirements.txt
# Start command: uvicorn server:app --host 0.0.0.0 --port $PORT
```

**20i (Static Portals)**
```bash
# Manual FTP upload
# Files: index.html, app.js, styles.css, config.js
```

### Cron Jobs (Render)

```bash
# Shift reminders - every 15 minutes
python cron_runner.py shift_reminders

# Data retention cleanup - daily 3 AM
python cron_runner.py data_retention
```

---

## 8. Monitoring & Logging

### Application Logs

```python
import logging

logging.info("API request received")
logging.warning("Rate limit warning")
logging.error("Database connection failed")
```

### Health Check

```
GET /api/health

Response:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-02-25T12:00:00Z"
}
```

### Key Metrics

- API response times
- Error rates
- Active sessions
- AI token usage
- Safeguarding alert counts

---

## 9. Testing

### API Testing

```bash
# Health check
curl https://veterans-support-api.onrender.com/api/health

# Login
curl -X POST https://veterans-support-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'

# Authenticated request
curl https://veterans-support-api.onrender.com/api/counsellors \
  -H "Authorization: Bearer eyJ..."
```

### Test Credentials

| Role | Email | Notes |
|------|-------|-------|
| Admin | admin@veteran.dbty.co.uk | Full access |

---

## 10. Future Technical Considerations

### Scalability
- Horizontal scaling on Render
- MongoDB Atlas auto-scaling
- CDN caching for static assets

### Performance
- Response caching (Redis)
- Database indexing optimisation
- Image compression pipeline

### Security Enhancements
- Two-factor authentication
- API key rotation
- Audit logging expansion

---

*Radio Check Technical Documentation*
*Version 2.6.0 - February 2026*
