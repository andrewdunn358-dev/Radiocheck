# AI Safeguarding Features - Radio Check

## Overview

Radio Check implements a multi-layered AI safety system designed to protect users while preserving the authentic peer support experience. The system wraps around AI personas without altering their personalities, focusing on contextual crisis detection, dependency monitoring, and age-appropriate safeguarding.

## Age Gate System

### Purpose
Collects date of birth to enable age-appropriate safeguarding measures while maintaining user privacy.

### Implementation
- **DOB Storage**: Stored locally on user's device only (via AsyncStorage)
- **Privacy**: DOB is NEVER sent to the server - only an `is_under_18` flag is transmitted
- **Prompt Timing**: Shows after cookie consent and permission modals on first use

### Under-18 Restrictions

| Feature | Adult (18+) | Under-18 |
|---------|------------|----------|
| Peer Matching (Buddy Finder) | Enabled | **Disabled** |
| Direct Peer Calls | Enabled | **Disabled** |
| AI Chat Support | Enabled | Enabled |
| Crisis Support Resources | Enabled | Enabled |
| Staff Chat | Enabled | Enabled |
| Crisis Sensitivity | Standard | **+30% increased** |
| Human Escalation | Standard | **Accelerated** |
| Safeguarding Messages | Standard | **Stronger** |
| Risk Score Multiplier | 1.0x | **1.3x** |

### User Experience
- Under-18 users see a clear "Extra Protection Enabled" screen explaining their restrictions
- Restricted features show greyed-out states with friendly explanations
- Alternative support options are prominently displayed

## Contextual Crisis Detection

### Risk Scoring Algorithm
The system analyzes each message against multiple indicators:

1. **Explicit Crisis Keywords** (Weight: 100)
   - Direct statements of self-harm or suicide
   - Immediate danger language

2. **Distress Indicators** (Weight: 20-40)
   - Hopelessness expressions
   - Isolation language
   - Loss statements

3. **Severity Multipliers**
   - Temporal urgency ("right now", "tonight")
   - Plan specificity
   - Means mentions

4. **Session Context**
   - Message count (long sessions get increased monitoring)
   - Risk trend analysis
   - Previous crisis indicators in session

### Risk Levels

| Level | Score Range | Response |
|-------|------------|----------|
| LOW | 0-49 | Normal conversation |
| MEDIUM | 50-99 | Enhanced monitoring |
| HIGH | 100-149 | Staff notification |
| IMMINENT | 150+ | Immediate intervention |

## Dependency Monitoring

### Purpose
Detects patterns that suggest unhealthy over-reliance on AI support and encourages human connection.

### Monitored Patterns

1. **Frequency Indicators**
   - Multiple long sessions per day
   - Increasing session lengths over time
   - Regular late-night usage

2. **Language Patterns**
   - "Only you understand me"
   - "I can only talk to you"
   - Resistance to human support suggestions

### Intervention Strategy
- Gentle prompts toward human support options
- Information about professional resources
- Staff notification for persistent patterns

## Safety Interventions

### Immediate Actions (IMMINENT Risk)
1. Display crisis resources prominently
2. Notify all available staff immediately
3. Offer direct human connection
4. Log incident for safeguarding review

### Escalated Actions (HIGH Risk)
1. Prompt user with support options
2. Alert staff on duty
3. Provide crisis helplines
4. Track for follow-up

### Monitoring Actions (MEDIUM Risk)
1. Increase analysis sensitivity
2. Flag session for staff review
3. Prepare intervention resources

## Safety Logging

### Purpose
Formal logging for governance and DPIA (Data Protection Impact Assessment) preparation.

### Logged Information (Privacy-Preserved)
- Session ID (anonymized)
- Risk scores (no message content)
- Intervention types triggered
- Staff notification status
- Response outcomes

### NOT Logged
- Actual message content
- Personal identifying information
- Date of birth (stored locally only)

## AI Persona Integration

### Design Principle
The safety layer wraps around AI personas without changing their character. The AI personalities (e.g., Tommy, Doris, Hugo) maintain their authentic voice while the safety system monitors and intervenes when needed.

### How It Works
1. User message received
2. Safety layer analyzes message
3. Risk score calculated
4. If intervention needed → Safety response added
5. AI persona responds in character
6. Combined response sent to user

### Example Flow
```
User: "I feel like giving up"
                    ↓
[Safety Layer: Risk Score = 45 (MEDIUM)]
                    ↓
[AI Persona (Tommy): Responds with empathy in character]
                    ↓
[Safety Layer: Appends crisis resources if needed]
                    ↓
Final Response to User
```

## Technical Implementation

### Files
- `/app/backend/enhanced_safety_layer.py` - Core safety analysis
- `/app/backend/server.py` - Integration with chat endpoints
- `/app/frontend/src/hooks/useAgeGate.ts` - Age gate logic
- `/app/frontend/src/components/AgeGateModal.tsx` - DOB collection UI
- `/app/frontend/src/components/AgeRestrictedBanner.tsx` - Restriction UI

### API Changes
The `/api/ai-buddies/chat` endpoint now accepts:
```json
{
  "message": "string",
  "sessionId": "string",
  "character": "string",
  "is_under_18": boolean
}
```

### Response Includes
```json
{
  "reply": "string",
  "safeguardingTriggered": boolean,
  "safeguardingAlertId": "string (if triggered)",
  "safetyScore": number
}
```

## Crisis Resources Displayed

When intervention is triggered, users see:
- **Samaritans**: 116 123 (UK)
- **Veterans UK Helpline**: 0808 1914 218
- **Combat Stress**: 0800 138 1619
- **SSAFA**: 0800 731 4880
- **Emergency Services**: 999

## Governance Compliance

### DPIA Readiness
- All safety events logged with timestamps
- No personal data in logs
- Risk scores tracked for pattern analysis
- Staff actions documented

### Audit Trail
- Every intervention is recorded
- Staff acknowledgments logged
- Escalation paths documented
- Outcome tracking enabled

## Future Enhancements

1. **Machine Learning Integration**
   - Pattern recognition for subtle crisis indicators
   - Personalized risk thresholds

2. **Multi-Session Analysis**
   - Cross-session risk trending
   - Long-term dependency detection

3. **Staff Dashboard**
   - Real-time risk visualization
   - Historical intervention data
   - Pattern reporting

---

*Last Updated: December 2025*
*Version: 1.0*
