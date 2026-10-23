"""
Radio Check AI Tutor - Mr Clark
Evaluates written responses from learners using competency-based assessment
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import json
import logging
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

from routers.lms_auth import LmsCaller, get_lms_caller, require_lms_admin, ensure_self

router = APIRouter(tags=["AI Tutor"])

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Mr Clark's avatar and info
MR_CLARK = {
    "name": "Mr Clark",
    "avatar_url": "https://static.prod-images.emergentagent.com/jobs/535ca64e-70e1-4fc8-813d-3b487fc07905/images/a9bacd4dc492874cedeb536e97e322012136c6e4d632ddf2b353b4dad5037acb.png",
    "title": "Course Tutor",
    "intro": "Hello, I'm Mr Clark, your course tutor. I'll be guiding you through your peer support training and reviewing your reflective work to ensure you're ready to support fellow veterans."
}

# Competency framework for peer support training
COMPETENCY_FRAMEWORK = {
    "ethics": {
        "name": "Ethics & Boundaries",
        "key_concepts": [
            "confidentiality", "boundaries", "scope of practice", "referral", 
            "professional limits", "self-disclosure", "dual relationships",
            "BACP principles", "duty of care", "informed consent"
        ],
        "description": "Understanding ethical practice and knowing the limits of peer support"
    },
    "crisis": {
        "name": "Crisis Support",
        "key_concepts": [
            "suicide awareness", "risk assessment", "safety planning", 
            "emergency services", "de-escalation", "active listening",
            "NHS 111 option 2", "Samaritans", "crisis intervention"
        ],
        "description": "Recognising and responding to mental health crises"
    },
    "safeguarding": {
        "name": "Safeguarding",
        "key_concepts": [
            "vulnerable adults", "disclosure", "reporting", "duty to report",
            "child protection", "domestic abuse", "self-harm", "neglect",
            "safeguarding procedures", "confidentiality limits"
        ],
        "description": "Protecting vulnerable people and responding appropriately"
    },
    "communication": {
        "name": "Communication Skills",
        "key_concepts": [
            "active listening", "empathy", "open questions", "reflection",
            "summarising", "non-judgmental", "rapport building",
            "body language", "validation", "paraphrasing"
        ],
        "description": "Effective listening and communication techniques"
    },
    "ptsd_awareness": {
        "name": "PTSD Awareness",
        "key_concepts": [
            "triggers", "flashbacks", "hypervigilance", "avoidance",
            "trauma-informed", "grounding techniques", "veteran experience",
            "moral injury", "survivor guilt", "sleep disturbance"
        ],
        "description": "Understanding and supporting veterans with PTSD"
    }
}

# Reflection questions for critical modules
CRITICAL_MODULE_REFLECTIONS = {
    "m3-ethics": {
        "module_name": "Ethics and Boundaries",
        "questions": [
            {
                "id": "ethics_q1",
                "type": "scenario",
                "question": "A veteran you're supporting asks you to keep a secret about their self-harm. They say they trust only you and will stop talking if you tell anyone. How would you respond?",
                "competencies": ["ethics", "safeguarding"],
                "key_concepts_expected": ["confidentiality limits", "duty of care", "safeguarding", "professional limits"]
            },
            {
                "id": "ethics_q2",
                "type": "reflection",
                "question": "Explain in your own words why boundaries are important in peer support, and give an example of a boundary you would set.",
                "competencies": ["ethics"],
                "key_concepts_expected": ["boundaries", "scope of practice", "self-disclosure", "dual relationships"]
            }
        ]
    },
    "m5-crisis": {
        "module_name": "Crisis Support and Suicide Awareness",
        "questions": [
            {
                "id": "crisis_q1",
                "type": "scenario",
                "question": "During a peer support call, a veteran says 'I've had enough. I don't see any point going on. I've been thinking about ending it.' Walk through exactly how you would respond in the next few minutes.",
                "competencies": ["crisis", "communication"],
                "key_concepts_expected": ["suicide awareness", "safety planning", "active listening", "emergency services", "de-escalation"]
            },
            {
                "id": "crisis_q2",
                "type": "reflection",
                "question": "What resources would you signpost to a veteran in crisis, and why is it important not to promise secrecy in these situations?",
                "competencies": ["crisis", "ethics"],
                "key_concepts_expected": ["NHS 111 option 2", "Samaritans", "confidentiality limits", "duty of care"]
            }
        ]
    },
    "m10-safeguarding": {
        "module_name": "Safeguarding",
        "questions": [
            {
                "id": "safeguarding_q1",
                "type": "scenario",
                "question": "A veteran mentions that their partner has been 'getting physical' when they argue, but quickly says 'it's nothing, forget I said anything.' How would you handle this disclosure?",
                "competencies": ["safeguarding", "communication"],
                "key_concepts_expected": ["disclosure", "domestic abuse", "reporting", "active listening", "safeguarding procedures"]
            },
            {
                "id": "safeguarding_q2",
                "type": "reflection",
                "question": "When does your duty to protect someone override their confidentiality? Give specific examples.",
                "competencies": ["safeguarding", "ethics"],
                "key_concepts_expected": ["duty to report", "confidentiality limits", "vulnerable adults", "self-harm", "child protection"]
            }
        ]
    }
}

# Final assessment questions
FINAL_ASSESSMENT = {
    "title": "Final Course Assessment",
    "description": "Complete these reflective questions to demonstrate your understanding of peer support principles.",
    "questions": [
        {
            "id": "final_q1",
            "type": "scenario",
            "question": "You've been supporting a veteran for 3 months. They've started calling you daily, sometimes late at night, and have said you're the only person who understands them. They've also asked to meet for coffee 'as friends.' How do you navigate this situation while maintaining your role as a peer supporter?",
            "competencies": ["ethics", "communication"],
            "key_concepts_expected": ["boundaries", "dual relationships", "scope of practice", "referral"]
        },
        {
            "id": "final_q2",
            "type": "scenario",
            "question": "During a group session, a veteran becomes visibly distressed when another member describes combat experiences. They start trembling, seem disconnected, and their breathing becomes rapid. What do you do?",
            "competencies": ["ptsd_awareness", "crisis", "communication"],
            "key_concepts_expected": ["triggers", "flashbacks", "grounding techniques", "de-escalation", "trauma-informed"]
        },
        {
            "id": "final_q3",
            "type": "reflection",
            "question": "Reflect on what you've learned about the difference between peer support and professional counselling. Why is it important to know your limits, and how will you look after your own wellbeing while supporting others?",
            "competencies": ["ethics", "communication"],
            "key_concepts_expected": ["scope of practice", "professional limits", "self-care", "referral", "boundaries"]
        }
    ]
}


class ReflectionSubmission(BaseModel):
    """Submission of a reflection question"""
    learner_email: str
    module_id: str
    question_id: str
    response: str


class FinalAssessmentSubmission(BaseModel):
    """Submission of final assessment"""
    learner_email: str
    responses: Dict[str, str]  # question_id: response


class TutorFeedback(BaseModel):
    """AI Tutor feedback response"""
    passed: bool
    score: int  # 0-100
    competencies_demonstrated: List[str]
    competencies_missing: List[str]
    key_concepts_found: List[str]
    key_concepts_missing: List[str]
    feedback: str
    tutor_message: str
    needs_admin_review: bool
    admin_review_reason: Optional[str] = None


def get_db():
    """Get database connection"""
    from server import db
    return db


async def evaluate_response(question: dict, response: str) -> TutorFeedback:
    """Use AI to evaluate a learner's response"""
    
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="AI Tutor not configured - missing OpenAI API key")
    
    # Build the competency context
    competency_context = []
    for comp_id in question.get("competencies", []):
        if comp_id in COMPETENCY_FRAMEWORK:
            comp = COMPETENCY_FRAMEWORK[comp_id]
            competency_context.append(f"- {comp['name']}: {comp['description']}\n  Key concepts: {', '.join(comp['key_concepts'])}")
    
    system_message = f"""You are Mr Clark, an experienced peer support trainer evaluating learner responses for Radio Check veteran peer support training.

Your role is to assess whether the learner demonstrates understanding of key competencies required to become a peer supporter.

## Assessment Framework

You must evaluate responses based on COMPETENCY-BASED assessment:
- Check if the learner demonstrates understanding of required competencies
- Look for mentions of key concepts (directly or indirectly referenced)
- Assess whether their approach would be safe and appropriate
- Provide constructive, encouraging feedback

## Competencies for this question:
{chr(10).join(competency_context)}

## Key concepts the learner should demonstrate:
{', '.join(question.get('key_concepts_expected', []))}

## Evaluation Criteria:
- PASS: Learner demonstrates understanding of most key concepts and would respond safely/appropriately
- NEEDS REVIEW: Response is unclear, contains concerning elements, or only partially demonstrates competency
- FAIL: Learner shows fundamental misunderstanding that could lead to unsafe practice

## Response Format:
You MUST respond with valid JSON only, no other text:
{{
    "passed": true/false,
    "score": 0-100,
    "competencies_demonstrated": ["list of competency IDs demonstrated"],
    "competencies_missing": ["list of competency IDs not demonstrated"],
    "key_concepts_found": ["list of key concepts the learner addressed"],
    "key_concepts_missing": ["list of key concepts not addressed"],
    "feedback": "Detailed constructive feedback for the learner",
    "needs_admin_review": true/false,
    "admin_review_reason": "Reason for flagging (if applicable, else null)"
}}

Be encouraging but honest. The goal is to ensure learners are safe to support vulnerable veterans."""

    user_prompt = f"""## Question ({question.get('type', 'reflection')} question):
{question['question']}

## Learner's Response:
{response}

Please evaluate this response and provide your assessment as JSON."""

    try:
        completion = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3
        )
        
        result = completion.choices[0].message.content
        
        # Parse JSON response
        result_text = result.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        evaluation = json.loads(result_text.strip())
        
        # Build tutor message
        if evaluation.get("passed"):
            tutor_message = f"Well done! You've demonstrated a good understanding of the key concepts. {evaluation.get('feedback', '')}"
        else:
            tutor_message = f"Thank you for your response. There are some areas we need to develop further. {evaluation.get('feedback', '')}"
        
        return TutorFeedback(
            passed=evaluation.get("passed", False),
            score=evaluation.get("score", 0),
            competencies_demonstrated=evaluation.get("competencies_demonstrated", []),
            competencies_missing=evaluation.get("competencies_missing", []),
            key_concepts_found=evaluation.get("key_concepts_found", []),
            key_concepts_missing=evaluation.get("key_concepts_missing", []),
            feedback=evaluation.get("feedback", ""),
            tutor_message=tutor_message,
            needs_admin_review=evaluation.get("needs_admin_review", False),
            admin_review_reason=evaluation.get("admin_review_reason")
        )
        
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse AI response: {e}")
        # Return a needs-review response
        return TutorFeedback(
            passed=False,
            score=0,
            competencies_demonstrated=[],
            competencies_missing=question.get("competencies", []),
            key_concepts_found=[],
            key_concepts_missing=question.get("key_concepts_expected", []),
            feedback="Your response is being reviewed by our team.",
            tutor_message="Thank you for your response. I've flagged this for additional review by our training team.",
            needs_admin_review=True,
            admin_review_reason="AI evaluation failed - manual review required"
        )
    except Exception as e:
        logging.error(f"AI Tutor error: {e}")
        raise HTTPException(status_code=500, detail="AI Tutor temporarily unavailable")


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/api/lms/tutor/info")
async def get_tutor_info():
    """Get Mr Clark's information"""
    return MR_CLARK


@router.get("/api/lms/tutor/module-intro/{module_id}")
async def get_module_intro(module_id: str):
    """Get Mr Clark's introduction for a module"""
    
    # Module introductions by Mr Clark
    module_intros = {
        "m1-intro": "Welcome to your first module! Understanding mental health is the foundation of peer support. Take your time with this material - it sets the stage for everything that follows.",
        "m2-algee": "The ALGEE framework is your toolkit for providing effective peer support. Remember, you don't need to have all the answers - you need to know how to listen and when to guide someone to professional help.",
        "m3-ethics": "This is one of our critical modules. Ethics and boundaries might seem restrictive, but they actually protect both you and the veterans you'll support. Pay close attention here.",
        "m4-communication": "Good communication isn't about saying the right thing - it's about creating a space where someone feels truly heard. These skills will serve you in every interaction.",
        "m5-crisis": "Crisis support is challenging but vital. Remember: your role is to provide immediate support and connect people with professional help, not to manage a crisis alone.",
        "m6-ptsd": "Many veterans you meet will be affected by PTSD. Understanding their experiences will help you provide compassionate, informed support.",
        "m7-depression": "Depression and anxiety are common among our veteran community. What you learn here will help you recognise the signs and respond appropriately.",
        "m8-selfcare": "You cannot pour from an empty cup. Self-care isn't selfish - it's essential for anyone in a supporting role.",
        "m9-substance": "Substance misuse often accompanies other mental health challenges. Approach this topic without judgment - understanding is the first step to helping.",
        "m10-safeguarding": "Another critical module. Safeguarding is about protecting vulnerable people, and sometimes that means making difficult decisions. Trust the procedures.",
        "m11-diversity": "Every veteran's experience is unique. This module helps ensure you can provide inclusive support to all who need it.",
        "m12-practical": "Time to bring everything together. These practical skills will form the backbone of your peer support work.",
        "m13-casestudies": "Let's apply what you've learned to realistic scenarios. Don't worry about getting everything perfect - this is about developing your judgment.",
        "m14-completion": "You've come a long way! This final module prepares you for your role as a Radio Check peer supporter. I'm proud of your dedication."
    }
    
    intro = module_intros.get(module_id, "Welcome to this module. Take your time to absorb the material.")
    
    return {
        "tutor": MR_CLARK,
        "module_id": module_id,
        "introduction": intro
    }


@router.get("/api/lms/tutor/reflection-questions/{module_id}")
async def get_reflection_questions(module_id: str):
    """Get reflection questions for a critical module"""
    
    if module_id not in CRITICAL_MODULE_REFLECTIONS:
        return {
            "has_reflection": False,
            "module_id": module_id,
            "message": "This module does not have mandatory reflection questions."
        }
    
    reflection = CRITICAL_MODULE_REFLECTIONS[module_id]
    
    return {
        "has_reflection": True,
        "module_id": module_id,
        "module_name": reflection["module_name"],
        "tutor": MR_CLARK,
        "intro_message": f"Before completing this module, I'd like you to reflect on what you've learned. Please answer the following questions thoughtfully - your responses will help ensure you're ready to support vulnerable veterans.",
        "questions": [
            {
                "id": q["id"],
                "type": q["type"],
                "question": q["question"]
            }
            for q in reflection["questions"]
        ]
    }


@router.post("/api/lms/tutor/submit-reflection")
async def submit_reflection(submission: ReflectionSubmission, caller: LmsCaller = Depends(get_lms_caller)):
    """Submit a reflection response for AI evaluation"""
    ensure_self(caller, submission.learner_email)
    db = get_db()
    
    # Validate module has reflections
    if submission.module_id not in CRITICAL_MODULE_REFLECTIONS:
        raise HTTPException(status_code=400, detail="This module does not have reflection questions")
    
    # Find the question
    questions = CRITICAL_MODULE_REFLECTIONS[submission.module_id]["questions"]
    question = next((q for q in questions if q["id"] == submission.question_id), None)
    
    if not question:
        raise HTTPException(status_code=400, detail="Question not found")
    
    # Validate response length
    if len(submission.response.strip()) < 50:
        raise HTTPException(status_code=400, detail="Please provide a more detailed response (at least 50 characters)")
    
    # Evaluate with AI
    feedback = await evaluate_response(question, submission.response)
    
    # Store submission
    submission_data = {
        "learner_email": submission.learner_email,
        "module_id": submission.module_id,
        "question_id": submission.question_id,
        "response": submission.response,
        "evaluation": {
            "passed": feedback.passed,
            "score": feedback.score,
            "competencies_demonstrated": feedback.competencies_demonstrated,
            "competencies_missing": feedback.competencies_missing,
            "key_concepts_found": feedback.key_concepts_found,
            "key_concepts_missing": feedback.key_concepts_missing,
            "feedback": feedback.feedback,
            "needs_admin_review": feedback.needs_admin_review,
            "admin_review_reason": feedback.admin_review_reason
        },
        "submitted_at": datetime.now(timezone.utc),
        "reviewed_by_admin": False
    }
    
    await db.lms_reflections.insert_one(submission_data)
    
    return {
        "success": True,
        "tutor": MR_CLARK,
        "evaluation": feedback.dict()
    }


@router.get("/api/lms/tutor/final-assessment")
async def get_final_assessment():
    """Get the final assessment questions"""
    return {
        "tutor": MR_CLARK,
        "assessment": {
            "title": FINAL_ASSESSMENT["title"],
            "description": FINAL_ASSESSMENT["description"],
            "intro_message": "Congratulations on reaching the final assessment! This is your opportunity to demonstrate everything you've learned. Take your time, reflect carefully, and show me you're ready to be a Radio Check peer supporter.",
            "questions": [
                {
                    "id": q["id"],
                    "type": q["type"],
                    "question": q["question"]
                }
                for q in FINAL_ASSESSMENT["questions"]
            ]
        }
    }


@router.post("/api/lms/tutor/submit-final-assessment")
async def submit_final_assessment(submission: FinalAssessmentSubmission, caller: LmsCaller = Depends(get_lms_caller)):
    """Submit final assessment for AI evaluation"""
    ensure_self(caller, submission.learner_email)
    db = get_db()
    
    # Evaluate each response
    results = []
    total_score = 0
    all_passed = True
    needs_admin_review = False
    admin_review_reasons = []
    
    for question in FINAL_ASSESSMENT["questions"]:
        response = submission.responses.get(question["id"])
        if not response or len(response.strip()) < 50:
            raise HTTPException(
                status_code=400, 
                detail=f"Please provide a detailed response for question: {question['question'][:50]}..."
            )
        
        feedback = await evaluate_response(question, response)
        results.append({
            "question_id": question["id"],
            "passed": feedback.passed,
            "score": feedback.score,
            "feedback": feedback.feedback,
            "competencies_demonstrated": feedback.competencies_demonstrated
        })
        
        total_score += feedback.score
        if not feedback.passed:
            all_passed = False
        if feedback.needs_admin_review:
            needs_admin_review = True
            admin_review_reasons.append(feedback.admin_review_reason)
    
    average_score = total_score // len(FINAL_ASSESSMENT["questions"])
    overall_passed = all_passed and average_score >= 70
    
    # Store final assessment
    assessment_data = {
        "learner_email": submission.learner_email,
        "responses": submission.responses,
        "results": results,
        "average_score": average_score,
        "passed": overall_passed,
        "needs_admin_review": needs_admin_review,
        "admin_review_reasons": admin_review_reasons,
        "submitted_at": datetime.now(timezone.utc),
        "reviewed_by_admin": False
    }
    
    await db.lms_final_assessments.insert_one(assessment_data)
    
    # Update learner progress if passed
    if overall_passed and not needs_admin_review:
        await db.lms_learners.update_one(
            {"email": submission.learner_email},
            {"$set": {"final_assessment_passed": True, "final_assessment_date": datetime.now(timezone.utc)}}
        )
    
    # Generate tutor summary message
    if overall_passed and not needs_admin_review:
        tutor_message = f"Excellent work! You've demonstrated strong understanding across all areas. Your average score is {average_score}%. You're now ready to receive your certificate and begin your journey as a Radio Check peer supporter. I'm proud of your achievement."
    elif needs_admin_review:
        tutor_message = f"Thank you for completing the assessment. Your responses have been submitted for review by our training team. They will be in touch within 48 hours. Your preliminary score is {average_score}%."
    else:
        tutor_message = f"Thank you for your effort. Your score of {average_score}% is below the 70% pass mark. Please review the feedback for each question and try again when you feel ready. Remember, this isn't about perfection - it's about ensuring you can safely support vulnerable veterans."
    
    return {
        "success": True,
        "tutor": MR_CLARK,
        "overall_passed": overall_passed,
        "average_score": average_score,
        "needs_admin_review": needs_admin_review,
        "tutor_message": tutor_message,
        "results": results
    }


@router.get("/api/lms/admin/reflections")
async def admin_get_reflections(needs_review: bool = False, _admin=Depends(require_lms_admin)):
    """Admin: Get all reflection submissions"""
    db = get_db()
    
    query = {}
    if needs_review:
        query["evaluation.needs_admin_review"] = True
        query["reviewed_by_admin"] = False
    
    reflections = await db.lms_reflections.find(query).sort("submitted_at", -1).to_list(100)
    
    for r in reflections:
        r["_id"] = str(r["_id"])
    
    return {"reflections": reflections}


@router.get("/api/lms/admin/final-assessments")
async def admin_get_final_assessments(needs_review: bool = False, _admin=Depends(require_lms_admin)):
    """Admin: Get all final assessment submissions"""
    db = get_db()
    
    query = {}
    if needs_review:
        query["needs_admin_review"] = True
        query["reviewed_by_admin"] = False
    
    assessments = await db.lms_final_assessments.find(query).sort("submitted_at", -1).to_list(100)
    
    for a in assessments:
        a["_id"] = str(a["_id"])
    
    return {"assessments": assessments}


@router.post("/api/lms/admin/reflection/{reflection_id}/review")
async def admin_review_reflection(reflection_id: str, passed: bool, admin_notes: str = None, _admin=Depends(require_lms_admin)):
    """Admin: Review and approve/reject a flagged reflection"""
    db = get_db()
    
    from bson import ObjectId
    
    try:
        result = await db.lms_reflections.update_one(
            {"_id": ObjectId(reflection_id)},
            {
                "$set": {
                    "reviewed_by_admin": True,
                    "admin_decision": "approved" if passed else "rejected",
                    "admin_notes": admin_notes,
                    "admin_reviewed_at": datetime.now(timezone.utc),
                    "evaluation.passed": passed
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Reflection not found")
        
        return {"success": True, "message": "Reflection reviewed successfully"}
    except:
        raise HTTPException(status_code=400, detail="Invalid reflection ID")



# ============================================================================
# MR CLARK CHAT SYSTEM
# ============================================================================

MR_CLARK_SYSTEM_PROMPT = """You are Mr Clark, the RadioCheck Tutor - an AI teaching assistant for the RadioCheck Peer-to-Peer Support Training Programme.

Your role is to teach, guide, and assess students learning peer support and Mental Health First Aid skills in the UK.

You are NOT a therapist and NOT a crisis counsellor.
Your purpose is education, reflection, and skills development.

You must always operate in alignment with:
• UK Mental Health First Aid (MHFA) principles
• The BACP Ethical Framework for the Counselling Professions
• UK safeguarding practices and duty of care principles
• Evidence-informed peer support training models used in the UK

You help students understand how to support others safely, not how to replace professional services.

## CRITICAL RULE - QUIZ AND ASSESSMENT ANSWERS

YOU MUST NEVER:
- Give direct answers to quiz questions
- Tell students which multiple choice option is correct
- Provide the exact wording expected in assessment answers
- Complete assignments for students

Instead, you should:
- Guide them to think through the concepts
- Ask reflective questions to help them find the answer themselves
- Point them to relevant sections of the course material
- Explain the underlying principles without giving the specific answer

If a student asks "What is the answer to question X?" respond with:
"I'm here to help you learn, not to give you the answers directly. Let me help you think through this - what do you understand about [relevant concept]? What do you think would be the safest/most ethical approach?"

## Core Behaviour

You act like a supportive tutor and course mentor.

Your tone must be:
• supportive
• calm
• respectful
• non-judgemental
• encouraging of reflection

You encourage critical thinking and learning, not just giving answers.
You prioritise psychological safety and ethical awareness in all teaching.

## What You Help Students With

You assist students with:
• understanding Mental Health First Aid concepts
• peer-support communication skills
• active listening techniques
• recognising signs of distress
• ethical boundaries
• appropriate signposting
• safeguarding awareness
• reflective practice
• understanding written coursework and assignments (but NOT providing answers)

You may:
• explain concepts in general terms
• help students reflect on scenarios
• ask reflective questions
• clarify misunderstandings about course material
• guide them toward the right thinking approach

## Ethical Framework

You must reflect the key principles of the BACP Ethical Framework, including:
• respect
• autonomy
• beneficence
• non-maleficence
• justice
• trustworthiness
• professional boundaries

You reinforce that peer supporters listen, support, and signpost — they do not diagnose or treat.

## Safeguarding Awareness

Safeguarding is important but not your primary role.

If safeguarding issues arise in student discussions:
• acknowledge concern
• reinforce the importance of following safeguarding procedures
• encourage contacting appropriate supervisors or safeguarding leads

You do not conduct risk assessments or crisis interventions.

## Teaching Style

You use a guided learning approach.

Where appropriate you:
• ask reflective questions
• encourage empathy and perspective taking
• reinforce safe peer-support practices
• connect answers back to MHFA principles

You help students build confidence and ethical awareness.

## Boundaries

You must NOT:
• act as a therapist
• provide clinical diagnosis
• provide treatment advice
• replace professional mental health services
• GIVE QUIZ OR ASSESSMENT ANSWERS

Your role is education and training only.

## Overall Goal

Your goal is to help students become:
• safe peer supporters
• ethically aware helpers
• confident listeners
• responsible signposters

The training should always emphasise:
"Support, listen, and guide people toward appropriate help."

Remember: You are Mr Clark, a friendly but firm educator. Be warm and supportive, but never compromise on the rule about not giving direct answers to assessments."""


class TutorChatMessage(BaseModel):
    """Chat message to Mr Clark"""
    learner_email: str
    message: str
    current_module: Optional[str] = None


class TutorChatResponse(BaseModel):
    """Response from Mr Clark"""
    response: str
    tutor: dict


# Store chat sessions in memory - conversation history per learner
chat_histories = {}


@router.post("/api/lms/tutor/chat")
async def chat_with_tutor(message: TutorChatMessage, caller: LmsCaller = Depends(get_lms_caller)):
    """Chat with Mr Clark - the AI tutor"""
    ensure_self(caller, message.learner_email)
    
    if not openai_client.api_key:
        raise HTTPException(status_code=500, detail="AI Tutor not configured - missing OpenAI API key")
    
    # Create session ID based on learner email
    session_id = f"tutor-chat-{message.learner_email}"
    
    # Add context about current module if provided
    context_addition = ""
    if message.current_module:
        context_addition = f"\n\n[Context: The student is currently studying module '{message.current_module}'. Keep your answers relevant to peer support training but do NOT give direct quiz answers.]"
    
    try:
        # Get or create conversation history for this learner
        if session_id not in chat_histories:
            chat_histories[session_id] = []
        
        history = chat_histories[session_id]
        
        # Build messages list with history
        messages = [
            {"role": "system", "content": MR_CLARK_SYSTEM_PROMPT + context_addition}
        ]
        
        # Add conversation history (limit to last 10 exchanges to avoid token limits)
        for h in history[-20:]:  # Last 10 pairs
            messages.append(h)
        
        # Add current message
        messages.append({"role": "user", "content": message.message})
        
        # Call OpenAI
        completion = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7
        )
        
        response = completion.choices[0].message.content
        
        # Store in history
        history.append({"role": "user", "content": message.message})
        history.append({"role": "assistant", "content": response})
        
        # Store the conversation in database for review
        db = get_db()
        await db.tutor_conversations.insert_one({
            "learner_email": message.learner_email,
            "session_id": session_id,
            "message": message.message,
            "response": response,
            "current_module": message.current_module,
            "timestamp": datetime.now(timezone.utc)
        })
        
        return {
            "response": response,
            "tutor": MR_CLARK
        }
        
    except Exception as e:
        logging.error(f"Tutor chat error: {e}")
        raise HTTPException(status_code=500, detail="Mr Clark is temporarily unavailable. Please try again.")


@router.delete("/api/lms/tutor/chat/clear")
async def clear_chat_session(learner_email: str, caller: LmsCaller = Depends(get_lms_caller)):
    """Clear chat history for a learner"""
    ensure_self(caller, learner_email)
    session_id = f"tutor-chat-{learner_email}"
    if session_id in chat_histories:
        del chat_histories[session_id]
    return {"success": True, "message": "Chat session cleared"}


@router.get("/api/lms/admin/tutor-conversations")
async def get_tutor_conversations(learner_email: Optional[str] = None, limit: int = 100, _admin=Depends(require_lms_admin)):
    """Admin: View tutor conversations for review"""
    db = get_db()
    
    query = {}
    if learner_email:
        query["learner_email"] = learner_email
    
    conversations = await db.tutor_conversations.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for c in conversations:
        c["_id"] = str(c["_id"])
    
    return {"conversations": conversations}
