"""
Shift Reminder Service

Sends email reminders to staff before their shifts:
- 24 hours before shift
- 1 hour before shift

Run this script as a cron job every 15 minutes:
    */15 * * * * cd /app/backend && python scripts/shift_reminders.py

Or use the API endpoint to trigger manually:
    POST /api/shifts/send-reminders
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import resend

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
log_dir = ROOT_DIR / 'logs'
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'shift_reminders.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'veterans_support')
resend.api_key = os.environ.get('RESEND_API_KEY')

# Reminder windows (in minutes before shift)
REMINDER_WINDOWS = [
    {'name': '24_hour', 'minutes': 24 * 60, 'tolerance': 30},  # 24 hours ± 30 min
    {'name': '1_hour', 'minutes': 60, 'tolerance': 15},         # 1 hour ± 15 min
]


def parse_shift_datetime(shift_date: str, shift_time: str) -> datetime:
    """Convert shift date and time strings to datetime object"""
    try:
        # Handle both date string and date object
        if isinstance(shift_date, datetime):
            date_str = shift_date.strftime('%Y-%m-%d')
        else:
            date_str = str(shift_date)
        
        dt_str = f"{date_str} {shift_time}"
        return datetime.strptime(dt_str, '%Y-%m-%d %H:%M').replace(tzinfo=timezone.utc)
    except Exception as e:
        logger.error(f"Error parsing shift datetime: {e}")
        return None


async def get_staff_email(db, user_id: str) -> str:
    """Get staff member's email from database"""
    if not user_id:
        return None
    
    # Check counsellors collection
    staff = await db.counsellors.find_one({"id": user_id})
    if staff and staff.get('email'):
        return staff['email']
    
    # Check peer_supporters collection
    staff = await db.peer_supporters.find_one({"id": user_id})
    if staff and staff.get('email'):
        return staff['email']
    
    # Check users collection
    user = await db.users.find_one({"id": user_id})
    if user and user.get('email'):
        return user['email']
    
    return None


async def send_reminder_email(staff_email: str, shift: dict, reminder_type: str) -> bool:
    """Send reminder email to staff member"""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set, skipping email")
        return False
    
    if not staff_email:
        logger.warning(f"No email for shift {shift.get('id')}")
        return False
    
    # Format the reminder message based on type
    if reminder_type == '24_hour':
        time_text = "tomorrow"
        urgency = ""
    else:  # 1_hour
        time_text = "in 1 hour"
        urgency = "⏰ "
    
    shift_date = shift.get('date', 'N/A')
    if isinstance(shift_date, datetime):
        shift_date = shift_date.strftime('%A, %d %B %Y')
    
    try:
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": [staff_email],
            "subject": f"{urgency}Shift Reminder - Your shift starts {time_text}",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">📻 Radio Check</h1>
                        <p style="color: #a0c4e8; margin: 5px 0 0 0;">Shift Reminder</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #1e3a5f; margin-top: 0;">
                            {urgency}Your shift starts {time_text}
                        </h2>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2d5a87;">
                            <p style="margin: 0 0 10px 0;"><strong>📅 Date:</strong> {shift_date}</p>
                            <p style="margin: 0 0 10px 0;"><strong>🕐 Start Time:</strong> {shift.get('start_time', 'N/A')}</p>
                            <p style="margin: 0;"><strong>🕕 End Time:</strong> {shift.get('end_time', 'N/A')}</p>
                        </div>
                        
                        <p style="color: #666; margin-top: 20px;">
                            Please ensure you're ready to support our veterans. Log in to the 
                            <a href="https://staff.radiocheck.me" style="color: #2d5a87;">Staff Portal</a> 
                            for more details.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            If you cannot attend this shift, please contact your supervisor immediately.
                        </p>
                    </div>
                </div>
            """
        })
        logger.info(f"Sent {reminder_type} reminder to {staff_email} for shift {shift.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send reminder email: {e}")
        return False


async def check_and_send_reminders():
    """Main function to check for upcoming shifts and send reminders"""
    logger.info("Starting shift reminder check...")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    stats = {
        'started_at': datetime.now(timezone.utc).isoformat(),
        'reminders_sent': {'24_hour': 0, '1_hour': 0},
        'errors': []
    }
    
    now = datetime.now(timezone.utc)
    
    try:
        # Get all shifts for today and tomorrow
        today = now.date()
        tomorrow = (now + timedelta(days=1)).date()
        
        shifts_cursor = db.shifts.find({
            'date': {'$in': [str(today), str(tomorrow), today, tomorrow]}
        })
        
        shifts = await shifts_cursor.to_list(length=100)
        logger.info(f"Found {len(shifts)} shifts to check")
        
        for shift in shifts:
            shift_start = parse_shift_datetime(shift.get('date'), shift.get('start_time', '09:00'))
            
            if not shift_start:
                continue
            
            # Skip shifts that have already started
            if shift_start <= now:
                continue
            
            minutes_until_shift = (shift_start - now).total_seconds() / 60
            
            for window in REMINDER_WINDOWS:
                window_start = window['minutes'] - window['tolerance']
                window_end = window['minutes'] + window['tolerance']
                
                if window_start <= minutes_until_shift <= window_end:
                    # Check if we've already sent this reminder
                    reminder_key = f"reminder_{window['name']}_{shift.get('id')}"
                    existing = await db.sent_reminders.find_one({'key': reminder_key})
                    
                    if existing:
                        logger.debug(f"Already sent {window['name']} reminder for shift {shift.get('id')}")
                        continue
                    
                    # Get staff email
                    staff_email = await get_staff_email(db, shift.get('user_id'))
                    
                    if staff_email:
                        success = await send_reminder_email(staff_email, shift, window['name'])
                        
                        if success:
                            # Record that we sent this reminder
                            await db.sent_reminders.insert_one({
                                'key': reminder_key,
                                'shift_id': shift.get('id'),
                                'reminder_type': window['name'],
                                'sent_to': staff_email,
                                'sent_at': datetime.now(timezone.utc)
                            })
                            stats['reminders_sent'][window['name']] += 1
                    else:
                        logger.warning(f"No email found for user {shift.get('user_id')} on shift {shift.get('id')}")
        
        stats['completed_at'] = datetime.now(timezone.utc).isoformat()
        stats['status'] = 'success'
        
        # Clean up old reminder records (older than 7 days)
        cleanup_date = now - timedelta(days=7)
        await db.sent_reminders.delete_many({'sent_at': {'$lt': cleanup_date}})
        
    except Exception as e:
        stats['status'] = 'failed'
        stats['error'] = str(e)
        logger.error(f"Reminder check failed: {e}")
    
    finally:
        client.close()
    
    logger.info(f"Shift reminder check completed: {stats}")
    return stats


if __name__ == "__main__":
    result = asyncio.run(check_and_send_reminders())
    sys.exit(0 if result.get('status') == 'success' else 1)
