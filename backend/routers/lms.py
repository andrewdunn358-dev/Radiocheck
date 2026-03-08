"""
Radio Check Peer to Peer Training LMS - Backend API
Handles courses, modules, quizzes, progress tracking, and certificates
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import secrets
import logging
import os
import resend
import bcrypt
import jwt

# Import the full curriculum
from routers.lms_curriculum_part2 import get_full_curriculum

router = APIRouter(tags=["LMS"])

# Initialize Resend
resend.api_key = os.getenv("RESEND_API_KEY")
LMS_JWT_SECRET = os.getenv("JWT_SECRET", "radiocheck-lms-secret-key-2024")

# Get the full curriculum with all 14 modules
MHFA_CURRICULUM = get_full_curriculum()

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


class ManualLearnerAdd(BaseModel):
    """Admin manually add a learner with password"""
    full_name: str
    email: str
    password: str
    notes: Optional[str] = None


class LearnerLogin(BaseModel):
    """Learner login with email and password"""
    email: str
    password: str


class LearnerSetPassword(BaseModel):
    """Set password for a learner (first login after approval)"""
    email: str
    password: str
    confirm_password: str


# ============================================================================
# PASSWORD UTILITY FUNCTIONS
# ============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def create_learner_token(email: str, full_name: str) -> str:
    """Create a JWT token for a learner"""
    payload = {
        "email": email,
        "full_name": full_name,
        "type": "learner",
        "iat": datetime.now(timezone.utc).timestamp(),
        "exp": (datetime.now(timezone.utc).timestamp()) + (7 * 24 * 60 * 60)  # 7 days
    }
    return jwt.encode(payload, LMS_JWT_SECRET, algorithm="HS256")

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


# ============================================================================
# LEARNER AUTH ENDPOINTS
# ============================================================================

@router.post("/api/lms/learner/set-password")
async def set_learner_password(data: LearnerSetPassword):
    """Set password for a learner (first login after approval)"""
    db = get_db()
    
    # Validate passwords match
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Check password strength
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Find the learner
    learner = await db.lms_learners.find_one({"email": data.email.lower()})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found. Please ensure you've been approved first.")
    
    # Check if password already set
    if learner.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password already set. Please use the login form.")
    
    # Hash and save password
    password_hash = hash_password(data.password)
    await db.lms_learners.update_one(
        {"email": data.email.lower()},
        {"$set": {"password_hash": password_hash, "password_set_at": datetime.now(timezone.utc)}}
    )
    
    # Generate token
    token = create_learner_token(learner["email"], learner["full_name"])
    
    return {
        "success": True,
        "message": "Password set successfully! You can now log in.",
        "token": token,
        "learner": {
            "email": learner["email"],
            "full_name": learner["full_name"]
        }
    }


@router.post("/api/lms/learner/login")
async def learner_login(data: LearnerLogin):
    """Login for learners with email and password"""
    db = get_db()
    
    # Find the learner
    learner = await db.lms_learners.find_one({"email": data.email.lower()})
    if not learner:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if password has been set
    if not learner.get("password_hash"):
        raise HTTPException(
            status_code=400, 
            detail="Password not set. Please set your password first using the link from your approval email."
        )
    
    # Verify password
    if not verify_password(data.password, learner["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update last login
    await db.lms_learners.update_one(
        {"email": data.email.lower()},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    # Generate token
    token = create_learner_token(learner["email"], learner["full_name"])
    
    return {
        "success": True,
        "token": token,
        "learner": {
            "email": learner["email"],
            "full_name": learner["full_name"],
            "progress_percent": round(
                (len(learner["progress"]["completed_modules"]) / len(MHFA_CURRICULUM["modules"])) * 100
            )
        }
    }


@router.get("/api/lms/learner/check-status/{email}")
async def check_learner_status(email: str):
    """Check if a learner exists and their password status"""
    db = get_db()
    
    learner = await db.lms_learners.find_one({"email": email.lower()})
    if not learner:
        return {
            "exists": False,
            "message": "Not enrolled. Please register your interest first."
        }
    
    return {
        "exists": True,
        "has_password": bool(learner.get("password_hash")),
        "full_name": learner["full_name"]
    }

@router.post("/api/lms/enroll")
async def enroll_learner(enrollment: LearnerEnrollment):
    """Enroll a learner in the course"""
    db = get_db()
    
    # Check if already enrolled (case-insensitive)
    existing = await db.lms_learners.find_one({"email": enrollment.email.lower()})
    if existing:
        return {
            "success": True,
            "learner_id": str(existing["_id"]),
            "message": "You're already enrolled! Continue your learning.",
            "already_enrolled": True
        }
    
    # Create learner record
    learner_data = {
        "email": enrollment.email.lower(),
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
    
    # Find learner (case-insensitive)
    learner = await db.lms_learners.find_one({"email": learner_email.lower()})
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
    
    # Find learner (case-insensitive)
    learner_email_lower = learner_email.lower()
    learner = await db.lms_learners.find_one({"email": learner_email_lower})
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
                {"email": learner_email_lower},
                {"$push": {"progress.completed_modules": submission.module_id}}
            )
    
    await db.lms_learners.update_one({"email": learner_email_lower}, {"$set": update_data})
    
    # Record quiz attempt
    attempt_data = {
        "learner_email": learner_email_lower,
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
    
    # Case-insensitive email lookup
    learner = await db.lms_learners.find_one({"email": learner_email.lower()}, {"_id": 0})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
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
    
    # Case-insensitive email lookup
    learner_email_lower = learner_email.lower()
    learner = await db.lms_learners.find_one({"email": learner_email_lower})
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
        "learner_email": learner_email_lower,
        "learner_name": learner["full_name"],
        "course_title": MHFA_CURRICULUM["title"],
        "issued_at": datetime.now(timezone.utc),
        "valid": True
    }
    
    await db.lms_certificates.insert_one(certificate_data)
    
    # Update learner
    await db.lms_learners.update_one(
        {"email": learner_email_lower},
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

@router.get("/api/lms/admin/module/{module_id}")
async def get_admin_module_details(module_id: str):
    """Get full module details including quiz questions for admin view"""
    module = next((m for m in MHFA_CURRICULUM["modules"] if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Return full module data including quiz
    return {
        "id": module["id"],
        "title": module["title"],
        "description": module["description"],
        "duration_minutes": module["duration_minutes"],
        "order": module["order"],
        "is_critical": module["is_critical"],
        "image_url": module.get("image_url"),
        "content": module["content"],
        "external_links": module.get("external_links", []),
        "quiz": module.get("quiz")
    }

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
    """Send approval notification email via Resend"""
    try:
        if not resend.api_key:
            logging.warning("No Resend API key configured - skipping email")
            return
            
        email_body = f"""
Dear {name},

Great news! Your application to become a Radio Check peer support volunteer has been approved!

You are now enrolled in the Radio Check Peer to Peer Training course. 

To get started:
1. Visit the Learning Portal at https://radiocheck.me/training
2. Log in with your email: {email}
3. Complete the training modules at your own pace

Remember: You'll need to complete a DBS check before you can start volunteering.
Apply here: https://www.gov.uk/request-copy-criminal-record

If you have any questions, please contact us at course@radiocheck.me

Welcome to the team!

The Radio Check Team
        """
        
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": [email],
            "subject": "Your Radio Check Volunteer Application is Approved!",
            "text": email_body.strip()
        })
        logging.info(f"Approval email sent to {email}")
    except Exception as e:
        logging.error(f"Failed to send approval email: {e}")

@router.post("/api/lms/admin/learner/add")
async def admin_add_learner(learner: ManualLearnerAdd, background_tasks: BackgroundTasks):
    """Admin manually add a learner without requiring registration"""
    db = get_db()
    
    # Validate password length
    if len(learner.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Check if already enrolled
    existing = await db.lms_learners.find_one({"email": learner.email.lower()})
    if existing:
        return {
            "success": True,
            "message": f"{learner.full_name} is already enrolled",
            "already_enrolled": True,
            "learner_id": str(existing["_id"])
        }
    
    # Hash the password
    password_hash = hash_password(learner.password)
    
    # Create learner record with password
    learner_data = {
        "email": learner.email.lower(),
        "full_name": learner.full_name,
        "password_hash": password_hash,
        "password_set_at": datetime.now(timezone.utc),
        "registration_id": None,
        "manual_add": True,
        "manual_add_notes": learner.notes,
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
    
    # Send welcome email (background task)
    background_tasks.add_task(send_approval_email, learner.email.lower(), learner.full_name)
    
    return {
        "success": True,
        "message": f"Successfully enrolled {learner.full_name}. They can now log in with their email and password.",
        "learner_id": str(result.inserted_id),
        "email": learner.email.lower()
    }



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
    """Send rejection notification email via Resend"""
    try:
        if not resend.api_key:
            logging.warning("No Resend API key configured - skipping email")
            return
            
        email_body = f"""
Dear {name},

Thank you for your interest in becoming a Radio Check peer support volunteer.

After careful consideration, we are unable to proceed with your application at this time.

{f"Reason: {reason}" if reason else ""}

If you have any questions or would like to discuss this further, please contact us at course@radiocheck.me

Best wishes,
The Radio Check Team
        """
        
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": [email],
            "subject": "Update on Your Radio Check Volunteer Application",
            "text": email_body.strip()
        })
        logging.info(f"Rejection email sent to {email}")
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



# ============================================================================
# ADMIN LEARNER MANAGEMENT ENDPOINTS
# ============================================================================

class LearnerUpdate(BaseModel):
    """Update learner details"""
    full_name: Optional[str] = None
    notes: Optional[str] = None


class PasswordReset(BaseModel):
    """Reset password for a learner"""
    new_password: str


@router.get("/api/lms/admin/learner/{learner_email}")
async def admin_get_learner(learner_email: str):
    """Get detailed learner info for admin"""
    db = get_db()
    
    learner = await db.lms_learners.find_one({"email": learner_email.lower()})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    # Don't send password hash
    learner.pop("password_hash", None)
    learner["_id"] = str(learner["_id"])
    
    return {"learner": learner}


@router.put("/api/lms/admin/learner/{learner_email}")
async def admin_update_learner(learner_email: str, data: LearnerUpdate):
    """Update learner details"""
    db = get_db()
    
    update_data = {}
    if data.full_name:
        update_data["full_name"] = data.full_name
    if data.notes is not None:
        update_data["manual_add_notes"] = data.notes
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.lms_learners.update_one(
        {"email": learner_email.lower()},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    return {"success": True, "message": "Learner updated successfully"}


@router.post("/api/lms/admin/learner/{learner_email}/reset-password")
async def admin_reset_password(learner_email: str, data: PasswordReset):
    """Reset a learner's password"""
    db = get_db()
    
    # Validate password length
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Check learner exists
    learner = await db.lms_learners.find_one({"email": learner_email.lower()})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    # Hash and update password
    password_hash = hash_password(data.new_password)
    
    await db.lms_learners.update_one(
        {"email": learner_email.lower()},
        {"$set": {
            "password_hash": password_hash,
            "password_reset_at": datetime.now(timezone.utc),
            "password_reset_by_admin": True
        }}
    )
    
    return {"success": True, "message": f"Password reset for {learner_email}"}


@router.delete("/api/lms/admin/learner/{learner_email}")
async def admin_delete_learner(learner_email: str):
    """Delete a learner and all their data"""
    db = get_db()
    
    # Check learner exists
    learner = await db.lms_learners.find_one({"email": learner_email.lower()})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    # Delete learner
    await db.lms_learners.delete_one({"email": learner_email.lower()})
    
    # Also delete their reflections and assessments
    await db.lms_reflections.delete_many({"learner_email": learner_email.lower()})
    await db.lms_final_assessments.delete_many({"learner_email": learner_email.lower()})
    await db.tutor_conversations.delete_many({"learner_email": learner_email.lower()})
    
    # Delete any registration
    await db.volunteer_registrations.delete_many({"email": learner_email.lower()})
    
    return {"success": True, "message": f"Learner {learner_email} and all associated data deleted"}
