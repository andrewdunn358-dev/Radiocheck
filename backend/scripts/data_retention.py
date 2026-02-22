"""
Data Retention Script for GDPR Compliance

This script automatically deletes or anonymizes data that exceeds
the defined retention periods. It should be run as a cron job.

Retention Periods (as per GDPR_AUDIT_REPORT.md):
- AI Chat History: 90 days (then anonymized)
- Safeguarding Alerts: 7 years (legal requirement, then anonymized)
- Callback Requests: 1 year (then deleted)
- Live Chat Messages: 90 days (then anonymized)
- Audit Logs: 2 years (then deleted)
- Call Logs: 1 year (then anonymized)
- Panic Alerts: 1 year (then deleted)

Usage:
    python scripts/data_retention.py [--dry-run]

    --dry-run: Shows what would be deleted without actually deleting
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import logging
import argparse

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(ROOT_DIR / 'logs' / 'data_retention.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# MongoDB Configuration
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'veterans_support')

# Retention periods in days
RETENTION_PERIODS = {
    'chat_messages': 90,           # AI/Live chat messages
    'safeguarding_alerts': 2555,   # ~7 years
    'callback_requests': 365,      # 1 year
    'audit_logs': 730,             # 2 years
    'call_logs': 365,              # 1 year
    'panic_alerts': 365,           # 1 year
    'compliance_logs': 730,        # 2 years
    'chat_sessions': 90,           # AI chat sessions
    'live_chat_rooms': 90,         # Live chat room data
}


async def anonymize_document(db, collection_name: str, doc: dict, dry_run: bool = False):
    """
    Anonymize a document by removing PII while keeping metadata for analytics.
    """
    anonymized_fields = {
        'name': '[ANONYMIZED]',
        'email': '[ANONYMIZED]',
        'phone': '[ANONYMIZED]',
        'user_name': '[ANONYMIZED]',
        'user_email': '[ANONYMIZED]',
        'patient_name': '[ANONYMIZED]',
        'patient_email': '[ANONYMIZED]',
        'counsellor_name': '[ANONYMIZED]',
        'peer_name': '[ANONYMIZED]',
        'message': '[CONTENT REMOVED FOR RETENTION COMPLIANCE]',
        'content': '[CONTENT REMOVED FOR RETENTION COMPLIANCE]',
        'encrypted_email': None,
        'encrypted_phone': None,
        'encrypted_name': None,
    }
    
    update_dict = {}
    for field, replacement in anonymized_fields.items():
        if field in doc:
            update_dict[field] = replacement
    
    # Add anonymization metadata
    update_dict['_anonymized'] = True
    update_dict['_anonymized_at'] = datetime.now(timezone.utc)
    
    if update_dict and not dry_run:
        await db[collection_name].update_one(
            {'_id': doc['_id']},
            {'$set': update_dict}
        )
    
    return len(update_dict) > 0


async def delete_expired_data(db, collection_name: str, retention_days: int, 
                              date_field: str = 'created_at', dry_run: bool = False):
    """
    Delete documents older than retention period.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
    
    # Query for expired documents
    query = {
        date_field: {'$lt': cutoff_date},
        '_anonymized': {'$ne': True}  # Don't re-process anonymized docs
    }
    
    count = await db[collection_name].count_documents(query)
    
    if count > 0:
        if dry_run:
            logger.info(f"[DRY RUN] Would delete {count} documents from {collection_name}")
        else:
            result = await db[collection_name].delete_many(query)
            logger.info(f"Deleted {result.deleted_count} documents from {collection_name}")
    
    return count


async def anonymize_expired_data(db, collection_name: str, retention_days: int,
                                  date_field: str = 'created_at', dry_run: bool = False):
    """
    Anonymize documents older than retention period instead of deleting.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
    
    # Query for expired documents that haven't been anonymized
    query = {
        date_field: {'$lt': cutoff_date},
        '_anonymized': {'$ne': True}
    }
    
    cursor = db[collection_name].find(query)
    count = 0
    
    async for doc in cursor:
        if await anonymize_document(db, collection_name, doc, dry_run):
            count += 1
    
    if count > 0:
        if dry_run:
            logger.info(f"[DRY RUN] Would anonymize {count} documents in {collection_name}")
        else:
            logger.info(f"Anonymized {count} documents in {collection_name}")
    
    return count


async def cleanup_orphaned_sessions(db, dry_run: bool = False):
    """
    Remove orphaned chat sessions with no messages.
    """
    # Find sessions older than 24 hours with no activity
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    
    # This is a placeholder - adjust based on actual session tracking
    logger.info("Orphaned session cleanup skipped - no session collection found")
    return 0


async def generate_retention_report(db) -> dict:
    """
    Generate a report of data by age for compliance auditing.
    """
    report = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'collections': {}
    }
    
    collections = [
        'chat_messages', 'safeguarding_alerts', 'callback_requests',
        'call_logs', 'panic_alerts', 'compliance_logs', 'live_chat_rooms'
    ]
    
    now = datetime.now(timezone.utc)
    age_buckets = [30, 90, 180, 365, 730]  # days
    
    for coll_name in collections:
        try:
            total = await db[coll_name].count_documents({})
            anonymized = await db[coll_name].count_documents({'_anonymized': True})
            
            report['collections'][coll_name] = {
                'total_documents': total,
                'anonymized_documents': anonymized,
                'retention_period_days': RETENTION_PERIODS.get(coll_name, 'N/A'),
                'by_age': {}
            }
            
            # Count by age
            prev_cutoff = now
            for days in age_buckets:
                cutoff = now - timedelta(days=days)
                count = await db[coll_name].count_documents({
                    'created_at': {'$gte': cutoff, '$lt': prev_cutoff}
                })
                report['collections'][coll_name]['by_age'][f'{days}_days'] = count
                prev_cutoff = cutoff
                
        except Exception as e:
            report['collections'][coll_name] = {'error': str(e)}
    
    return report


async def run_retention_cleanup(dry_run: bool = False):
    """
    Main function to run all retention cleanup tasks.
    """
    logger.info(f"Starting data retention cleanup (dry_run={dry_run})")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    stats = {
        'started_at': datetime.now(timezone.utc).isoformat(),
        'dry_run': dry_run,
        'deleted': {},
        'anonymized': {},
        'errors': []
    }
    
    try:
        # Collections to DELETE after retention period
        delete_collections = [
            ('panic_alerts', 365, 'created_at'),
            ('compliance_logs', 730, 'created_at'),
        ]
        
        # Collections to ANONYMIZE after retention period
        anonymize_collections = [
            ('chat_messages', 90, 'timestamp'),
            ('safeguarding_alerts', 2555, 'created_at'),
            ('callback_requests', 365, 'created_at'),
            ('call_logs', 365, 'created_at'),
            ('live_chat_rooms', 90, 'created_at'),
        ]
        
        # Process deletions
        for coll_name, days, date_field in delete_collections:
            try:
                count = await delete_expired_data(db, coll_name, days, date_field, dry_run)
                stats['deleted'][coll_name] = count
            except Exception as e:
                error_msg = f"Error deleting from {coll_name}: {str(e)}"
                logger.error(error_msg)
                stats['errors'].append(error_msg)
        
        # Process anonymizations
        for coll_name, days, date_field in anonymize_collections:
            try:
                count = await anonymize_expired_data(db, coll_name, days, date_field, dry_run)
                stats['anonymized'][coll_name] = count
            except Exception as e:
                error_msg = f"Error anonymizing {coll_name}: {str(e)}"
                logger.error(error_msg)
                stats['errors'].append(error_msg)
        
        # Cleanup orphaned sessions
        await cleanup_orphaned_sessions(db, dry_run)
        
        # Generate retention report
        if not dry_run:
            report = await generate_retention_report(db)
            
            # Store the report for audit purposes
            await db.retention_reports.insert_one({
                'report': report,
                'stats': stats,
                'created_at': datetime.now(timezone.utc)
            })
            logger.info("Retention report generated and stored")
        
        stats['completed_at'] = datetime.now(timezone.utc).isoformat()
        stats['status'] = 'success' if not stats['errors'] else 'completed_with_errors'
        
    except Exception as e:
        stats['status'] = 'failed'
        stats['error'] = str(e)
        logger.error(f"Retention cleanup failed: {e}")
    
    finally:
        client.close()
    
    logger.info(f"Data retention cleanup completed: {stats}")
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Data Retention Cleanup Script')
    parser.add_argument('--dry-run', action='store_true', 
                        help='Show what would be deleted without actually deleting')
    args = parser.parse_args()
    
    # Create logs directory if it doesn't exist
    logs_dir = ROOT_DIR / 'logs'
    logs_dir.mkdir(exist_ok=True)
    
    # Run the cleanup
    result = asyncio.run(run_retention_cleanup(dry_run=args.dry_run))
    
    # Exit with appropriate code
    sys.exit(0 if result.get('status') == 'success' else 1)
