"""
Data Retention API Router

Provides endpoints for managing data retention policies and running cleanup tasks.
Admin only access — enforced by the router-level dependency below.

CONTAINMENT, 25 September 2026
-----------------------------
Until this change, the "Admin only access" above was a docstring and nothing
else. No route applied a dependency, the router declared none, server.py
included it with none, and the only middleware on the app is CORS — so all five
routes, including one that deletes from `users`, were reachable by an
unauthenticated caller.

The dependency is applied at router level rather than per route so that a route
added later inherits the boundary by default instead of opting into it.

`require_role` is Radio Check's existing admin gate (routers/auth.py:108) and is
what already guards the comparable endpoints — `delete_user` (:647),
`get_all_users` (:639) and `admin_reset_password` (:559). No new authentication
mechanism is introduced here, and nothing else in this file is changed.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from typing import Optional
import asyncio
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

from services.database import get_database
from routers.auth import require_role

router = APIRouter(
    prefix="/api/admin/data-retention",
    tags=["Data Retention"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get("/status")
async def get_retention_status():
    """
    Get the current data retention status and last cleanup report.
    """
    db = get_database()
    
    # Get the most recent retention report
    latest_report = await db.retention_reports.find_one(
        {},
        sort=[('created_at', -1)]
    )
    
    # Get retention policy configuration
    retention_config = {
        'chat_messages': {'retention_days': 90, 'action': 'anonymize'},
        'safeguarding_alerts': {'retention_days': 2555, 'action': 'anonymize', 'note': '7 years per legal requirement'},
        'callback_requests': {'retention_days': 365, 'action': 'anonymize'},
        'call_logs': {'retention_days': 365, 'action': 'anonymize'},
        'panic_alerts': {'retention_days': 365, 'action': 'delete'},
        'compliance_logs': {'retention_days': 730, 'action': 'delete'},
        'live_chat_rooms': {'retention_days': 90, 'action': 'anonymize'},
    }
    
    response = {
        'retention_policies': retention_config,
        'last_cleanup': None,
        'next_scheduled': None
    }
    
    if latest_report:
        # Remove MongoDB _id from response
        latest_report.pop('_id', None)
        response['last_cleanup'] = {
            'run_at': latest_report.get('created_at'),
            'stats': latest_report.get('stats'),
            'report_summary': {
                coll: {
                    'total': data.get('total_documents', 0),
                    'anonymized': data.get('anonymized_documents', 0)
                }
                for coll, data in latest_report.get('report', {}).get('collections', {}).items()
                if isinstance(data, dict) and 'error' not in data
            }
        }
    
    return response


@router.post("/run")
async def run_retention_cleanup(
    background_tasks: BackgroundTasks,
    dry_run: bool = True
):
    """
    Trigger a data retention cleanup.
    
    - dry_run=True (default): Shows what would be affected without making changes
    - dry_run=False: Actually performs the cleanup
    """
    from data_retention import run_retention_cleanup as do_cleanup
    
    if dry_run:
        # For dry run, execute immediately and return results
        result = await do_cleanup(dry_run=True)
        return {
            'status': 'completed',
            'dry_run': True,
            'result': result
        }
    else:
        # For actual cleanup, run in background
        background_tasks.add_task(asyncio.to_thread, asyncio.run, do_cleanup(dry_run=False))
        return {
            'status': 'started',
            'dry_run': False,
            'message': 'Cleanup task started in background. Check /status for results.'
        }


@router.get("/reports")
async def get_retention_reports(limit: int = 10):
    """
    Get recent retention cleanup reports for audit purposes.
    """
    db = get_database()
    
    cursor = db.retention_reports.find(
        {},
        {'_id': 0}
    ).sort('created_at', -1).limit(limit)
    
    reports = await cursor.to_list(length=limit)
    
    return {
        'reports': reports,
        'total_returned': len(reports)
    }


@router.delete("/user-data/{user_id}")
async def delete_user_data(user_id: str):
    """
    Delete all data for a specific user (GDPR Right to Erasure / "Right to be Forgotten").
    
    This will:
    - Remove user from users collection
    - Anonymize their messages and interactions
    - Remove their personal data from all collections
    """
    db = get_database()
    
    deletion_log = {
        'user_id': user_id,
        'requested_at': datetime.now(timezone.utc),
        'collections_affected': {}
    }
    
    try:
        # Collections that may contain user data
        user_data_collections = [
            ('users', {'id': user_id}),
            ('chat_messages', {'user_id': user_id}),
            ('callback_requests', {'user_id': user_id}),
            ('safeguarding_alerts', {'user_id': user_id}),
            ('call_logs', {'user_id': user_id}),
            ('notes', {'user_id': user_id}),
            ('mood_entries', {'user_id': user_id}),
        ]
        
        for coll_name, query in user_data_collections:
            try:
                # For users collection, delete
                if coll_name == 'users':
                    result = await db[coll_name].delete_many(query)
                    deletion_log['collections_affected'][coll_name] = {
                        'action': 'deleted',
                        'count': result.deleted_count
                    }
                else:
                    # For other collections, anonymize
                    result = await db[coll_name].update_many(
                        query,
                        {
                            '$set': {
                                'user_id': '[DELETED_USER]',
                                'message': '[CONTENT REMOVED PER GDPR REQUEST]',
                                '_gdpr_deleted': True,
                                '_gdpr_deleted_at': datetime.now(timezone.utc)
                            }
                        }
                    )
                    deletion_log['collections_affected'][coll_name] = {
                        'action': 'anonymized',
                        'count': result.modified_count
                    }
            except Exception as e:
                deletion_log['collections_affected'][coll_name] = {
                    'action': 'error',
                    'error': str(e)
                }
        
        deletion_log['status'] = 'completed'
        deletion_log['completed_at'] = datetime.now(timezone.utc)
        
        # Log the deletion for audit
        await db.gdpr_deletion_logs.insert_one(deletion_log)
        
        return {
            'status': 'success',
            'message': f'User data for {user_id} has been deleted/anonymized',
            'details': deletion_log['collections_affected']
        }
        
    except Exception as e:
        deletion_log['status'] = 'failed'
        deletion_log['error'] = str(e)
        await db.gdpr_deletion_logs.insert_one(deletion_log)
        
        raise HTTPException(
            status_code=500,
            detail=f'Failed to delete user data: {str(e)}'
        )


@router.get("/gdpr-requests")
async def get_gdpr_deletion_requests(limit: int = 50):
    """
    Get log of GDPR deletion requests for audit/compliance reporting.
    """
    db = get_database()
    
    cursor = db.gdpr_deletion_logs.find(
        {},
        {'_id': 0}
    ).sort('requested_at', -1).limit(limit)
    
    requests = await cursor.to_list(length=limit)
    
    return {
        'gdpr_deletion_requests': requests,
        'total_returned': len(requests)
    }
