"""
Radio Check Mental Health First Aid LMS - Backend API
Handles courses, modules, quizzes, progress tracking, and certificates
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import secrets
import logging

router = APIRouter(tags=["LMS"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class VolunteerRegistration(BaseModel):
    """Registration of interest to become a volunteer"""
    full_name: str
    email: str
    phone: Optional[str] = None
    is_veteran: bool = False
    service_branch: Optional[str] = None
    years_served: Optional[str] = None
    why_volunteer: str
    has_dbs: bool = False
    agreed_to_terms: bool = False

class LearnerEnrollment(BaseModel):
    """Learner enrollment in a course"""
    email: str
    full_name: str
    registration_id: Optional[str] = None

class QuizSubmission(BaseModel):
    """Quiz answer submission"""
    module_id: str
    answers: Dict[str, str]  # question_id: selected_answer

class ModuleCompletion(BaseModel):
    """Mark module as complete"""
    module_id: str
    time_spent_minutes: int

# ============================================================================
# COURSE CURRICULUM DATA
# ============================================================================

MHFA_CURRICULUM = {
    "course_id": "mhfa-volunteer-v1",
    "title": "Mental Health First Aid for Peer Supporters",
    "description": """This comprehensive course prepares you to become a Radio Check peer support volunteer. 
    You'll learn to provide safe, ethical mental health first aid to fellow veterans.
    
    Upon completion, you will be able to:
    • Recognise signs of mental health difficulties
    • Provide initial support using the ALGEE action plan
    • Know when and how to refer to professional services
    • Understand BACP ethical boundaries
    • Support veterans with PTSD, depression, anxiety, and crisis situations
    
    This course does NOT qualify you as a counsellor or therapist. 
    Peer supporters provide listening support and signposting only.""",
    "duration_hours": 16,
    "passing_score": 80,
    "critical_modules_pass_rate": 100,  # Ethics, Crisis, Safeguarding must be 100%
    "modules": [
        # ===== MODULE 1 =====
        {
            "id": "m1-intro",
            "title": "Introduction to Mental Health",
            "description": "Understanding mental health, mental illness, and the role of peer support",
            "duration_minutes": 60,
            "order": 1,
            "is_critical": False,
            "content": """
## What is Mental Health?

Mental health is a state of wellbeing in which an individual:
- Realises their own abilities
- Can cope with normal stresses of life
- Can work productively
- Can contribute to their community

**Mental health is not simply the absence of mental illness.** We all have mental health, just as we all have physical health.

## Mental Health vs Mental Illness

| Mental Health | Mental Illness |
|---------------|----------------|
| How we think, feel, and cope | A diagnosable condition |
| Fluctuates day to day | Requires professional treatment |
| Affected by life events | Has specific symptoms |
| Everyone has it | Affects 1 in 4 people |

## Veteran Mental Health Statistics

- **1 in 5** veterans experience depression, anxiety, or PTSD
- Veterans are **2-3x more likely** to experience depression than civilians
- **Average of 2 veteran suicides per week** in the UK
- Only **50%** of veterans with mental health issues seek help

## Barriers to Seeking Help

Veterans face unique barriers:
- **Stigma**: "Real soldiers don't need help"
- **Pride**: Self-reliance trained into them
- **Distrust**: Of non-military services
- **Identity**: Admitting struggle feels like weakness
- **Access**: Not knowing what's available

## The Role of Peer Support

As a peer supporter, you are NOT a therapist. You are:
- A listening ear
- Someone who understands military life
- A bridge to professional services
- A fellow veteran who gets it

**Your role is to SUPPORT, not to FIX.**
            """,
            "quiz": {
                "id": "q1-intro",
                "title": "Module 1 Quiz",
                "pass_rate": 80,
                "questions": [
                    {
                        "id": "q1-1",
                        "question": "Mental health is simply the absence of mental illness.",
                        "options": ["True", "False"],
                        "correct": "False",
                        "explanation": "Mental health is a state of wellbeing, not just the absence of illness. We all have mental health that fluctuates."
                    },
                    {
                        "id": "q1-2",
                        "question": "What proportion of veterans experience depression, anxiety, or PTSD?",
                        "options": ["1 in 10", "1 in 5", "1 in 2", "1 in 20"],
                        "correct": "1 in 5",
                        "explanation": "Research shows approximately 1 in 5 veterans experience these conditions."
                    },
                    {
                        "id": "q1-3",
                        "question": "As a peer supporter, your role is to:",
                        "options": [
                            "Diagnose mental health conditions",
                            "Provide therapy and treatment",
                            "Listen and signpost to professional services",
                            "Prescribe coping strategies"
                        ],
                        "correct": "Listen and signpost to professional services",
                        "explanation": "Peer supporters provide listening support and help people access professional services. They do not diagnose or treat."
                    },
                    {
                        "id": "q1-4",
                        "question": "Which is NOT a common barrier to veterans seeking help?",
                        "options": [
                            "Stigma around mental health",
                            "Too many services available",
                            "Pride and self-reliance",
                            "Distrust of civilian services"
                        ],
                        "correct": "Too many services available",
                        "explanation": "Lack of awareness of services is a barrier, not having too many. Stigma, pride, and distrust are all common barriers."
                    },
                    {
                        "id": "q1-5",
                        "question": "What percentage of veterans with mental health issues seek help?",
                        "options": ["25%", "50%", "75%", "90%"],
                        "correct": "50%",
                        "explanation": "Only about half of veterans with mental health issues seek professional help."
                    }
                ]
            }
        },
        # ===== MODULE 2 =====
        {
            "id": "m2-algee",
            "title": "The MHFA Action Plan - ALGEE",
            "description": "Learn the five-step action plan for providing mental health first aid",
            "duration_minutes": 60,
            "order": 2,
            "is_critical": False,
            "content": """
## The ALGEE Action Plan

ALGEE is the core framework for Mental Health First Aid. It provides a structured approach to helping someone experiencing mental health difficulties.

### A - Approach, Assess, Assist

**Approach** the person appropriately:
- Choose a suitable time and place
- Respect their privacy
- Be calm and patient

**Assess** for risk of suicide or harm:
- Look for warning signs
- Ask directly if concerned
- Take all threats seriously

**Assist** with any crisis:
- If immediate danger, call 999
- Stay with them
- Follow safeguarding protocols

### L - Listen Non-judgmentally

- Give your full attention
- Don't interrupt
- Accept what they say without judging
- Use open body language
- Reflect back what you hear
- Avoid giving advice too quickly

**DON'T SAY:**
- "You should..."
- "At least..."
- "I know how you feel"
- "Cheer up"
- "Others have it worse"

**DO SAY:**
- "I'm here for you"
- "That sounds really difficult"
- "Tell me more about that"
- "How are you coping with this?"

### G - Give Reassurance and Information

- Reassure them they've done the right thing by talking
- Remind them that help is available
- Share information about mental health when appropriate
- Don't minimise their experience
- Don't make promises you can't keep

### E - Encourage Appropriate Professional Help

Help them understand professional options:
- GP (first point of contact)
- NHS 111 Option 2 (mental health crisis)
- Op Courage (NHS veteran service)
- Combat Stress
- Private therapy

**How to encourage help-seeking:**
- Normalise it: "Lots of people find talking to someone helpful"
- Remove barriers: "I can help you find a number"
- Offer support: "Would you like me to be there when you call?"

### E - Encourage Self-Help and Other Supports

- Exercise and physical activity
- Connecting with others
- Routine and structure
- Limiting alcohol
- Peer support groups
- Hobbies and interests

**Remember: You are encouraging, not prescribing.**
            """,
            "quiz": {
                "id": "q2-algee",
                "title": "Module 2 Quiz - ALGEE",
                "pass_rate": 80,
                "questions": [
                    {
                        "id": "q2-1",
                        "question": "What does the 'A' in ALGEE stand for?",
                        "options": [
                            "Accept and Adapt",
                            "Approach, Assess, Assist",
                            "Ask and Answer",
                            "Attend and Act"
                        ],
                        "correct": "Approach, Assess, Assist",
                        "explanation": "The first step is to Approach the person, Assess for risk, and Assist with any crisis."
                    },
                    {
                        "id": "q2-2",
                        "question": "Which of these is an example of judgmental language to AVOID?",
                        "options": [
                            "That sounds really difficult",
                            "At least you have a job",
                            "Tell me more about how you're feeling",
                            "I'm here for you"
                        ],
                        "correct": "At least you have a job",
                        "explanation": "'At least...' statements minimise the person's experience and are judgmental."
                    },
                    {
                        "id": "q2-3",
                        "question": "When encouraging professional help, you should:",
                        "options": [
                            "Tell them they must see a doctor immediately",
                            "Diagnose their condition first",
                            "Normalise help-seeking and offer to support them",
                            "Give them a prescription"
                        ],
                        "correct": "Normalise help-seeking and offer to support them",
                        "explanation": "Encouraging professional help means making it feel normal and offering practical support to access it."
                    },
                    {
                        "id": "q2-4",
                        "question": "The second 'E' in ALGEE stands for:",
                        "options": [
                            "Educate about mental illness",
                            "Encourage self-help and other supports",
                            "Evaluate their progress",
                            "End the conversation appropriately"
                        ],
                        "correct": "Encourage self-help and other supports",
                        "explanation": "The final step encourages the person to use self-help strategies and connect with other supports."
                    },
                    {
                        "id": "q2-5",
                        "question": "If someone is in immediate danger, you should:",
                        "options": [
                            "Wait and see if they improve",
                            "Call 999",
                            "Send them a helpful article",
                            "Refer them to their GP next week"
                        ],
                        "correct": "Call 999",
                        "explanation": "Immediate danger requires immediate action - call emergency services."
                    }
                ]
            }
        },
        # ===== MODULE 3 - CRITICAL =====
        {
            "id": "m3-ethics",
            "title": "BACP Ethics & Boundaries",
            "description": "Understanding ethical practice and the boundaries of peer support",
            "duration_minutes": 60,
            "order": 3,
            "is_critical": True,  # MUST PASS 100%
            "content": """
## ⚠️ CRITICAL MODULE - 100% Pass Required

This module covers essential ethical boundaries. You must pass with 100% to continue.

## What Peer Support IS and IS NOT

### Peer Support IS:
- Listening without judgment
- Sharing your own experience (when appropriate)
- Signposting to professional services
- Providing emotional support
- Being a consistent, reliable presence
- Following safeguarding protocols

### Peer Support IS NOT:
- Therapy or counselling
- Diagnosing conditions
- Prescribing treatments or strategies
- Giving medical advice
- A substitute for professional help
- Available 24/7 at all times

## Boundaries of Competence

**You are competent to:**
- Listen and validate feelings
- Share information about resources
- Recognise warning signs
- Follow escalation procedures
- Refer to professionals

**You are NOT competent to:**
- Diagnose mental health conditions
- Provide therapy techniques (CBT, EMDR, etc.)
- Advise on medication
- Make decisions for the person
- Guarantee outcomes

## Confidentiality and Its Limits

**What you keep confidential:**
- Personal details shared with you
- The content of conversations
- Their contact information

**When confidentiality MUST be broken:**
- Immediate risk of suicide
- Risk of harm to others
- Disclosure of abuse (especially involving children)
- Serious crime disclosure
- Court order requiring disclosure

**Always inform:** "What you tell me is confidential, unless I'm worried about your safety or someone else's safety."

## Avoiding Dependency

Signs someone is becoming dependent:
- Only wants to talk to you
- Contacting you outside agreed times
- Expecting you to solve their problems
- Getting upset if you're unavailable

How to manage:
- Set clear boundaries from the start
- Encourage professional support
- Rotate peer supporters if possible
- Discuss with your supervisor

## Power Dynamics

Remember:
- You are in a position of trust
- The person may be vulnerable
- Your words carry weight
- Don't exploit this position

**Never:**
- Start a romantic relationship with someone you support
- Accept gifts of significant value
- Share personal contact details
- Meet outside agreed settings without approval

## Self-Disclosure Guidelines

Sharing your own experience CAN be helpful if:
- It's brief and relevant
- It normalises their experience
- It doesn't shift focus to you
- It's not competitive ("mine was worse")

**Good example:** "I've had times when everything felt overwhelming too. What helped me was talking to someone."

**Bad example:** "Oh, I had PTSD for 10 years and let me tell you about everything that happened to me..."

## Documentation

You MUST record:
- Date and time of contact
- Summary of key concerns
- Any safeguarding issues
- Actions taken
- Referrals made

This protects you AND the person you're supporting.
            """,
            "quiz": {
                "id": "q3-ethics",
                "title": "Module 3 Quiz - Ethics & Boundaries (100% Required)",
                "pass_rate": 100,  # CRITICAL
                "questions": [
                    {
                        "id": "q3-1",
                        "question": "As a peer supporter, you ARE qualified to:",
                        "options": [
                            "Diagnose depression",
                            "Listen and signpost to services",
                            "Recommend specific medications",
                            "Provide CBT therapy"
                        ],
                        "correct": "Listen and signpost to services",
                        "explanation": "Peer supporters provide listening support and signposting only. They do not diagnose or treat."
                    },
                    {
                        "id": "q3-2",
                        "question": "When MUST you break confidentiality?",
                        "options": [
                            "When the person asks you to",
                            "When you're curious about something",
                            "When there's risk of suicide or harm to others",
                            "When you want to tell your supervisor something interesting"
                        ],
                        "correct": "When there's risk of suicide or harm to others",
                        "explanation": "Confidentiality must be broken when there is a safeguarding concern - risk to the person or others."
                    },
                    {
                        "id": "q3-3",
                        "question": "A person you support asks you on a date. You should:",
                        "options": [
                            "Accept if they seem nice",
                            "Decline and explain professional boundaries",
                            "Accept but keep it secret",
                            "Wait until they're better, then date them"
                        ],
                        "correct": "Decline and explain professional boundaries",
                        "explanation": "Romantic relationships with people you support are never appropriate. This is a clear boundary."
                    },
                    {
                        "id": "q3-4",
                        "question": "Someone is becoming dependent on you, contacting you constantly. You should:",
                        "options": [
                            "Feel flattered and encourage it",
                            "Ignore them completely",
                            "Set clear boundaries and encourage professional support",
                            "Give them your personal phone number"
                        ],
                        "correct": "Set clear boundaries and encourage professional support",
                        "explanation": "Dependency should be managed with boundaries and professional referral, not encouraged or ignored."
                    },
                    {
                        "id": "q3-5",
                        "question": "When is self-disclosure appropriate?",
                        "options": [
                            "Whenever you want to talk about yourself",
                            "When it's brief, relevant, and normalises their experience",
                            "When your experience was worse than theirs",
                            "Never - you should never share anything personal"
                        ],
                        "correct": "When it's brief, relevant, and normalises their experience",
                        "explanation": "Self-disclosure can be helpful when brief and relevant, but should not shift focus to you."
                    },
                    {
                        "id": "q3-6",
                        "question": "You must document conversations because:",
                        "options": [
                            "It's interesting to read later",
                            "It protects you and the person, and tracks safeguarding",
                            "Your supervisor is nosy",
                            "You might forget who you talked to"
                        ],
                        "correct": "It protects you and the person, and tracks safeguarding",
                        "explanation": "Documentation is essential for safeguarding, continuity of care, and professional protection."
                    },
                    {
                        "id": "q3-7",
                        "question": "If someone discloses child abuse, you should:",
                        "options": [
                            "Keep it confidential as they asked",
                            "Immediately follow safeguarding procedures",
                            "Investigate it yourself first",
                            "Wait to see if they mention it again"
                        ],
                        "correct": "Immediately follow safeguarding procedures",
                        "explanation": "Child abuse disclosure requires immediate safeguarding action. This cannot be kept confidential."
                    },
                    {
                        "id": "q3-8",
                        "question": "The phrase 'peer support is not therapy' means:",
                        "options": [
                            "You're not as good as therapists",
                            "You have different training, boundaries, and scope",
                            "You can do therapy but call it something else",
                            "Therapy doesn't work"
                        ],
                        "correct": "You have different training, boundaries, and scope",
                        "explanation": "Peer support is valuable but has a different scope and boundaries than professional therapy."
                    }
                ]
            }
        },
        # ===== MODULE 4 =====
        {
            "id": "m4-communication",
            "title": "Communication Skills for Support",
            "description": "Developing effective listening and communication techniques",
            "duration_minutes": 60,
            "order": 4,
            "is_critical": False,
            "content": """
## Active Listening

Active listening is MORE than just hearing words. It involves:

### 1. Full Attention
- Put away distractions
- Maintain eye contact (in person) or focus (online)
- Don't plan what you'll say next
- Be present in the moment

### 2. Body Language
- Open posture
- Nodding to show understanding
- Leaning slightly forward
- Facial expressions that match the conversation

### 3. Verbal Encouragers
- "Mm-hmm"
- "I see"
- "Go on"
- "Tell me more"

## Open vs Closed Questions

### Open Questions (USE THESE)
Start with: What, How, Tell me about...
- "How are you feeling about that?"
- "What's been on your mind?"
- "Tell me more about what happened"

### Closed Questions (USE SPARINGLY)
Get yes/no answers:
- "Are you okay?" → Often gets "I'm fine"
- "Did that upset you?" → Yes/No

## Reflective Listening

Reflecting back what you hear shows you're listening and helps clarify.

**Simple Reflection:** Repeat key words
- Person: "I just feel so tired all the time"
- You: "You're feeling tired..."

**Paraphrasing:** Restate in your own words
- Person: "My wife doesn't understand what I went through"
- You: "It sounds like you feel there's a gap between your experiences and hers"

**Reflecting Feelings:** Name the emotion
- Person: "I don't know why I bother anymore"
- You: "It sounds like you might be feeling hopeless"

## Empathic Responses

**Empathy is NOT:**
- Fixing the problem
- Comparing experiences
- Giving advice immediately
- Saying "I know how you feel"

**Empathy IS:**
- Acknowledging their feelings
- Validating their experience
- Being present without judgment

**Examples:**
- "That sounds really difficult"
- "I can hear how much this is affecting you"
- "It makes sense that you'd feel that way"
- "Thank you for trusting me with this"

## What NOT to Say

❌ **Dismissive:**
- "You'll be fine"
- "Just think positive"
- "Others have it worse"
- "Snap out of it"

❌ **Judgmental:**
- "Why didn't you..."
- "You should have..."
- "That was silly"

❌ **Competitive:**
- "I had it worse when..."
- "At least you didn't..."

❌ **False Reassurance:**
- "Everything will be okay"
- "I promise it will get better"

## Handling Silence

Silence is okay! It can mean:
- They're processing
- They're gathering courage
- They need a moment

**Don't:**
- Rush to fill it
- Get uncomfortable
- Change the subject

**Do:**
- Sit with it
- Give them space
- Offer gentle prompts: "Take your time"
            """,
            "quiz": {
                "id": "q4-communication",
                "title": "Module 4 Quiz - Communication Skills",
                "pass_rate": 80,
                "questions": [
                    {
                        "id": "q4-1",
                        "question": "Which is an example of an OPEN question?",
                        "options": [
                            "Are you okay?",
                            "Did that make you angry?",
                            "How have you been coping with this?",
                            "Do you want help?"
                        ],
                        "correct": "How have you been coping with this?",
                        "explanation": "Open questions start with How, What, Tell me... and invite detailed responses."
                    },
                    {
                        "id": "q4-2",
                        "question": "Someone says 'I feel so alone.' A reflective response would be:",
                        "options": [
                            "You're not alone, you have me!",
                            "You're feeling isolated and disconnected",
                            "That's not true, you have family",
                            "You should join a club"
                        ],
                        "correct": "You're feeling isolated and disconnected",
                        "explanation": "Reflection acknowledges and mirrors back the feeling without dismissing or fixing."
                    },
                    {
                        "id": "q4-3",
                        "question": "When there's silence in a conversation, you should:",
                        "options": [
                            "Immediately fill it with questions",
                            "Change the subject",
                            "Allow space and give gentle prompts if needed",
                            "End the conversation"
                        ],
                        "correct": "Allow space and give gentle prompts if needed",
                        "explanation": "Silence can be processing time. Allow it without rushing."
                    },
                    {
                        "id": "q4-4",
                        "question": "'At least you have your health' is an example of:",
                        "options": [
                            "Empathic response",
                            "Active listening",
                            "Dismissive language",
                            "Open questioning"
                        ],
                        "correct": "Dismissive language",
                        "explanation": "'At least...' statements minimise the person's experience and dismiss their feelings."
                    },
                    {
                        "id": "q4-5",
                        "question": "Empathy involves:",
                        "options": [
                            "Fixing the person's problems",
                            "Sharing your worse experiences",
                            "Acknowledging and validating their feelings",
                            "Giving immediate advice"
                        ],
                        "correct": "Acknowledging and validating their feelings",
                        "explanation": "Empathy is about understanding and validating, not fixing or comparing."
                    }
                ]
            }
        },
        # Continue with more modules...
        # Modules 5-14 would follow the same structure
    ]
}

# ============================================================================
# API ENDPOINTS
# ============================================================================

def get_db():
    """Get database connection - imported from main server"""
    from server import db
    return db

@router.post("/api/lms/volunteer/register")
async def register_volunteer_interest(
    registration: VolunteerRegistration,
    background_tasks: BackgroundTasks
):
    """
    Register interest to become a volunteer.
    Sends email to course@radiocheck.me and creates admin alert.
    """
    db = get_db()
    
    if not registration.agreed_to_terms:
        raise HTTPException(status_code=400, detail="You must agree to the terms")
    
    # Create registration record
    reg_data = {
        "full_name": registration.full_name,
        "email": registration.email,
        "phone": registration.phone,
        "is_veteran": registration.is_veteran,
        "service_branch": registration.service_branch,
        "years_served": registration.years_served,
        "why_volunteer": registration.why_volunteer,
        "has_dbs": registration.has_dbs,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "admin_notified": False,
        "email_sent": False
    }
    
    result = await db.volunteer_registrations.insert_one(reg_data)
    reg_id = str(result.inserted_id)
    
    # Create admin alert
    alert_data = {
        "type": "volunteer_registration",
        "title": f"New Volunteer Interest: {registration.full_name}",
        "message": f"{registration.full_name} has registered interest in becoming a peer support volunteer.",
        "registration_id": reg_id,
        "email": registration.email,
        "is_veteran": registration.is_veteran,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.admin_alerts.insert_one(alert_data)
    
    # Queue email sending (background task)
    background_tasks.add_task(send_volunteer_registration_email, registration, reg_id)
    
    return {
        "success": True,
        "registration_id": reg_id,
        "message": "Thank you for your interest! We'll be in touch soon.",
        "next_steps": [
            "You will receive an email confirmation",
            "Our team will review your application",
            "If approved, you'll be enrolled in the training course",
            "You'll need to complete a DBS check before volunteering"
        ]
    }

async def send_volunteer_registration_email(registration: VolunteerRegistration, reg_id: str):
    """Send notification email to course@radiocheck.me"""
    try:
        # Import email sending function
        from routers.emails import send_email
        
        email_body = f"""
        New Volunteer Registration
        
        Name: {registration.full_name}
        Email: {registration.email}
        Phone: {registration.phone or 'Not provided'}
        
        Veteran: {'Yes' if registration.is_veteran else 'No'}
        Service Branch: {registration.service_branch or 'N/A'}
        Years Served: {registration.years_served or 'N/A'}
        
        Why they want to volunteer:
        {registration.why_volunteer}
        
        Has DBS: {'Yes' if registration.has_dbs else 'No - will need to apply'}
        
        Registration ID: {reg_id}
        
        Please log in to the admin portal to review this application.
        """
        
        await send_email(
            to="course@radiocheck.me",
            subject=f"New Volunteer Registration: {registration.full_name}",
            body=email_body
        )
        
        # Update registration as email sent
        db = get_db()
        db.volunteer_registrations.update_one(
            {"_id": ObjectId(reg_id)},
            {"$set": {"email_sent": True}}
        )
        
    except Exception as e:
        logging.error(f"Failed to send volunteer registration email: {e}")

@router.get("/api/lms/course")
async def get_course_info():
    """Get course information for public display"""
    return {
        "course_id": MHFA_CURRICULUM["course_id"],
        "title": MHFA_CURRICULUM["title"],
        "description": MHFA_CURRICULUM["description"],
        "duration_hours": MHFA_CURRICULUM["duration_hours"],
        "module_count": len(MHFA_CURRICULUM["modules"]),
        "modules": [
            {
                "id": m["id"],
                "title": m["title"],
                "description": m["description"],
                "duration_minutes": m["duration_minutes"],
                "is_critical": m["is_critical"]
            }
            for m in MHFA_CURRICULUM["modules"]
        ],
        "requirements": [
            "Internet connection",
            "Approximately 16 hours of study time",
            "DBS check (can be started during course)"
        ],
        "certification": "Radio Check Peer Supporter Certificate",
        "dbs_link": "https://www.gov.uk/request-copy-criminal-record"
    }

@router.post("/api/lms/enroll")
async def enroll_learner(enrollment: LearnerEnrollment):
    """Enroll a learner in the course"""
    db = get_db()
    
    # Check if already enrolled
    existing = await db.lms_learners.find_one({"email": enrollment.email})
    if existing:
        return {
            "success": True,
            "learner_id": str(existing["_id"]),
            "message": "You're already enrolled! Continue your learning.",
            "already_enrolled": True
        }
    
    # Create learner record
    learner_data = {
        "email": enrollment.email,
        "full_name": enrollment.full_name,
        "registration_id": enrollment.registration_id,
        "enrolled_at": datetime.now(timezone.utc),
        "course_id": MHFA_CURRICULUM["course_id"],
        "progress": {
            "completed_modules": [],
            "current_module": MHFA_CURRICULUM["modules"][0]["id"],
            "quiz_scores": {},
            "total_time_spent_minutes": 0
        },
        "certificate_issued": False,
        "certificate_id": None
    }
    
    result = await db.lms_learners.insert_one(learner_data)
    
    return {
        "success": True,
        "learner_id": str(result.inserted_id),
        "message": "Welcome! You're now enrolled in the course.",
        "first_module": MHFA_CURRICULUM["modules"][0]["id"]
    }

@router.get("/api/lms/module/{module_id}")
async def get_module(module_id: str, learner_email: str):
    """Get module content for a learner"""
    db = get_db()
    
    # Find learner
    learner = await db.lms_learners.find_one({"email": learner_email})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    # Find module
    module = next((m for m in MHFA_CURRICULUM["modules"] if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Check if previous modules completed (sequential learning)
    module_order = module["order"]
    if module_order > 1:
        prev_module_id = MHFA_CURRICULUM["modules"][module_order - 2]["id"]
        if prev_module_id not in learner["progress"]["completed_modules"]:
            raise HTTPException(
                status_code=403, 
                detail=f"You must complete the previous module first"
            )
    
    return {
        "module": module,
        "is_completed": module_id in learner["progress"]["completed_modules"],
        "quiz_score": learner["progress"]["quiz_scores"].get(module_id)
    }

@router.post("/api/lms/quiz/submit")
async def submit_quiz(submission: QuizSubmission, learner_email: str):
    """Submit quiz answers and get results"""
    db = get_db()
    
    # Find learner
    learner = await db.lms_learners.find_one({"email": learner_email})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    # Find module and quiz
    module = next((m for m in MHFA_CURRICULUM["modules"] if m["id"] == submission.module_id), None)
    if not module or "quiz" not in module:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = module["quiz"]
    
    # Grade quiz
    correct = 0
    total = len(quiz["questions"])
    results = []
    
    for question in quiz["questions"]:
        q_id = question["id"]
        user_answer = submission.answers.get(q_id)
        is_correct = user_answer == question["correct"]
        if is_correct:
            correct += 1
        results.append({
            "question_id": q_id,
            "question": question["question"],
            "your_answer": user_answer,
            "correct_answer": question["correct"],
            "is_correct": is_correct,
            "explanation": question["explanation"]
        })
    
    score = round((correct / total) * 100)
    passed = score >= quiz["pass_rate"]
    
    # Update learner progress
    update_data = {
        f"progress.quiz_scores.{submission.module_id}": score
    }
    
    if passed:
        # Add to completed modules if not already there
        if submission.module_id not in learner["progress"]["completed_modules"]:
            await db.lms_learners.update_one(
                {"email": learner_email},
                {"$push": {"progress.completed_modules": submission.module_id}}
            )
    
    await db.lms_learners.update_one({"email": learner_email}, {"$set": update_data})
    
    # Record quiz attempt
    attempt_data = {
        "learner_email": learner_email,
        "module_id": submission.module_id,
        "answers": submission.answers,
        "score": score,
        "passed": passed,
        "attempted_at": datetime.now(timezone.utc)
    }
    await db.lms_quiz_attempts.insert_one(attempt_data)
    
    return {
        "score": score,
        "passed": passed,
        "required_score": quiz["pass_rate"],
        "correct_count": correct,
        "total_questions": total,
        "results": results,
        "is_critical_module": module["is_critical"],
        "message": "Well done! You passed!" if passed else f"You need {quiz['pass_rate']}% to pass. Please review and try again."
    }

@router.get("/api/lms/progress/{learner_email}")
async def get_learner_progress(learner_email: str):
    """Get learner's course progress"""
    db = get_db()
    
    learner = await db.lms_learners.find_one({"email": learner_email}, {"_id": 0})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    total_modules = len(MHFA_CURRICULUM["modules"])
    completed_modules = len(learner["progress"]["completed_modules"])
    
    return {
        "learner": learner,
        "total_modules": total_modules,
        "completed_modules": completed_modules,
        "progress_percent": round((completed_modules / total_modules) * 100),
        "can_get_certificate": completed_modules == total_modules,
        "modules_status": [
            {
                "id": m["id"],
                "title": m["title"],
                "completed": m["id"] in learner["progress"]["completed_modules"],
                "score": learner["progress"]["quiz_scores"].get(m["id"]),
                "is_critical": m["is_critical"]
            }
            for m in MHFA_CURRICULUM["modules"]
        ]
    }

@router.post("/api/lms/certificate/generate")
async def generate_certificate(learner_email: str):
    """Generate certificate for completed course"""
    db = get_db()
    
    learner = await db.lms_learners.find_one({"email": learner_email})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    # Check all modules completed
    total_modules = len(MHFA_CURRICULUM["modules"])
    completed = len(learner["progress"]["completed_modules"])
    
    if completed < total_modules:
        raise HTTPException(
            status_code=400, 
            detail=f"You must complete all modules. {completed}/{total_modules} done."
        )
    
    # Check critical modules passed with 100%
    for module in MHFA_CURRICULUM["modules"]:
        if module["is_critical"]:
            score = learner["progress"]["quiz_scores"].get(module["id"], 0)
            if score < 100:
                raise HTTPException(
                    status_code=400,
                    detail=f"Critical module '{module['title']}' requires 100%. You scored {score}%."
                )
    
    # Generate certificate
    certificate_id = secrets.token_urlsafe(16)
    certificate_data = {
        "certificate_id": certificate_id,
        "learner_email": learner_email,
        "learner_name": learner["full_name"],
        "course_title": MHFA_CURRICULUM["title"],
        "issued_at": datetime.now(timezone.utc),
        "valid": True
    }
    
    await db.lms_certificates.insert_one(certificate_data)
    
    # Update learner
    await db.lms_learners.update_one(
        {"email": learner_email},
        {"$set": {"certificate_issued": True, "certificate_id": certificate_id}}
    )
    
    return {
        "success": True,
        "certificate_id": certificate_id,
        "learner_name": learner["full_name"],
        "course_title": MHFA_CURRICULUM["title"],
        "issued_date": certificate_data["issued_at"].isoformat(),
        "verification_url": f"/api/lms/certificate/verify/{certificate_id}"
    }

@router.get("/api/lms/certificate/verify/{certificate_id}")
async def verify_certificate(certificate_id: str):
    """Verify a certificate is valid"""
    db = get_db()
    
    cert = await db.lms_certificates.find_one({"certificate_id": certificate_id}, {"_id": 0})
    if not cert:
        return {"valid": False, "message": "Certificate not found"}
    
    return {
        "valid": cert["valid"],
        "learner_name": cert["learner_name"],
        "course_title": cert["course_title"],
        "issued_at": cert["issued_at"].isoformat() if cert.get("issued_at") else None
    }

# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@router.get("/api/lms/admin/registrations")
async def get_volunteer_registrations(status: str = None):
    """Get all volunteer registrations (admin)"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    registrations = await db.volunteer_registrations.find(query).sort("created_at", -1).to_list(100)
    
    for reg in registrations:
        reg["_id"] = str(reg["_id"])
    
    return {"registrations": registrations}

@router.get("/api/lms/admin/learners")
async def get_all_learners():
    """Get all learners (admin)"""
    db = get_db()
    
    learners = await db.lms_learners.find().sort("enrolled_at", -1).to_list(100)
    
    for learner in learners:
        learner["_id"] = str(learner["_id"])
        total_modules = len(MHFA_CURRICULUM["modules"])
        completed = len(learner["progress"]["completed_modules"])
        learner["progress_percent"] = round((completed / total_modules) * 100)
    
    return {"learners": learners}

@router.get("/api/lms/admin/alerts")
async def get_admin_alerts(unread_only: bool = False):
    """Get admin alerts for volunteer registrations"""
    db = get_db()
    
    query = {}
    if unread_only:
        query["read"] = False
    
    alerts = await db.admin_alerts.find(query).sort("created_at", -1).limit(50).to_list(50)
    
    for alert in alerts:
        alert["_id"] = str(alert["_id"])
    
    return {"alerts": alerts}

@router.post("/api/lms/admin/alert/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    """Mark an alert as read"""
    db = get_db()
    
    await db.admin_alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {"read": True}}
    )
    
    return {"success": True}


@router.post("/api/lms/admin/registration/{registration_id}/approve")
async def approve_registration(registration_id: str, background_tasks: BackgroundTasks):
    """Approve a volunteer registration and auto-enroll them in the course"""
    db = get_db()
    
    try:
        reg = await db.volunteer_registrations.find_one({"_id": ObjectId(registration_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid registration ID")
    
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    if reg["status"] == "approved":
        return {"success": True, "message": "Already approved", "already_approved": True}
    
    # Update registration status
    await db.volunteer_registrations.update_one(
        {"_id": ObjectId(registration_id)},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
    )
    
    # Auto-enroll the learner in the course
    existing_learner = await db.lms_learners.find_one({"email": reg["email"]})
    if not existing_learner:
        learner_data = {
            "email": reg["email"],
            "full_name": reg["full_name"],
            "registration_id": registration_id,
            "enrolled_at": datetime.now(timezone.utc),
            "course_id": MHFA_CURRICULUM["course_id"],
            "progress": {
                "completed_modules": [],
                "current_module": MHFA_CURRICULUM["modules"][0]["id"],
                "quiz_scores": {},
                "total_time_spent_minutes": 0
            },
            "certificate_issued": False,
            "certificate_id": None
        }
        await db.lms_learners.insert_one(learner_data)
    
    # Send approval email (background task)
    background_tasks.add_task(send_approval_email, reg["email"], reg["full_name"])
    
    return {
        "success": True,
        "message": f"Approved and enrolled {reg['full_name']} in the course",
        "email": reg["email"]
    }

async def send_approval_email(email: str, name: str):
    """Send approval notification email"""
    try:
        from routers.emails import send_email
        
        email_body = f"""
Dear {name},

Great news! Your application to become a Radio Check peer support volunteer has been approved!

You are now enrolled in the Mental Health First Aid training course. 

To get started:
1. Visit the Learning Portal
2. Log in with your email: {email}
3. Complete the training modules at your own pace

Remember: You'll need to complete a DBS check before you can start volunteering.
Apply here: https://www.gov.uk/request-copy-criminal-record

If you have any questions, please contact us at course@radiocheck.me

Welcome to the team!

The Radio Check Team
        """
        
        await send_email(
            to=email,
            subject="Your Radio Check Volunteer Application is Approved!",
            body=email_body
        )
    except Exception as e:
        logging.error(f"Failed to send approval email: {e}")

@router.post("/api/lms/admin/registration/{registration_id}/reject")
async def reject_registration(registration_id: str, reason: str = None, background_tasks: BackgroundTasks = None):
    """Reject a volunteer registration"""
    db = get_db()
    
    try:
        reg = await db.volunteer_registrations.find_one({"_id": ObjectId(registration_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid registration ID")
    
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Update registration status
    await db.volunteer_registrations.update_one(
        {"_id": ObjectId(registration_id)},
        {"$set": {
            "status": "rejected", 
            "rejected_at": datetime.now(timezone.utc),
            "rejection_reason": reason
        }}
    )
    
    # Send rejection email (background task)
    if background_tasks:
        background_tasks.add_task(send_rejection_email, reg["email"], reg["full_name"], reason)
    
    return {
        "success": True,
        "message": f"Registration for {reg['full_name']} has been rejected"
    }

async def send_rejection_email(email: str, name: str, reason: str = None):
    """Send rejection notification email"""
    try:
        from routers.emails import send_email
        
        email_body = f"""
Dear {name},

Thank you for your interest in becoming a Radio Check peer support volunteer.

After careful consideration, we are unable to proceed with your application at this time.

{f"Reason: {reason}" if reason else ""}

If you have any questions or would like to discuss this further, please contact us at course@radiocheck.me

Best wishes,
The Radio Check Team
        """
        
        await send_email(
            to=email,
            subject="Update on Your Radio Check Volunteer Application",
            body=email_body
        )
    except Exception as e:
        logging.error(f"Failed to send rejection email: {e}")

@router.post("/api/lms/admin/alerts/mark-all-read")
async def mark_all_alerts_read():
    """Mark all alerts as read"""
    db = get_db()
    
    await db.admin_alerts.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    
    return {"success": True}

@router.get("/api/lms/admin/certificates")
async def get_all_certificates():
    """Get all issued certificates"""
    db = get_db()
    
    certificates = await db.lms_certificates.find().sort("issued_at", -1).to_list(100)
    
    for cert in certificates:
        cert["_id"] = str(cert["_id"])
        if cert.get("issued_at"):
            cert["issued_at"] = cert["issued_at"].isoformat()
    
    return {"certificates": certificates}

@router.post("/api/lms/admin/certificate/{certificate_id}/revoke")
async def revoke_certificate(certificate_id: str):
    """Revoke a certificate"""
    db = get_db()
    
    result = await db.lms_certificates.update_one(
        {"certificate_id": certificate_id},
        {"$set": {"valid": False, "revoked_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    return {"success": True, "message": "Certificate revoked"}

