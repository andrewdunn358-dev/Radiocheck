"""
Field-Level Encryption Utility
AES-256 encryption for sensitive data fields
"""

import os
import base64
import hashlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import logging

logger = logging.getLogger(__name__)

# Cache for Fernet instance
_fernet_cache = None

def _get_fernet():
    """Get Fernet instance with derived key - loads key dynamically"""
    global _fernet_cache
    
    # Return cached instance if available
    if _fernet_cache is not None:
        return _fernet_cache
    
    # Get encryption key from environment at runtime
    encryption_key = os.environ.get('ENCRYPTION_KEY')
    
    if not encryption_key:
        logger.warning("ENCRYPTION_KEY not set - encryption disabled")
        return None
    
    # Derive a proper Fernet key from the secret
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'veterans_support_salt_v1',  # Static salt - key should be unique per deployment
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(encryption_key.encode()))
    _fernet_cache = Fernet(key)
    logger.info("Encryption initialized successfully")
    return _fernet_cache


def encrypt_field(value: str) -> str:
    """
    Encrypt a string value
    Returns prefixed encrypted string or original if encryption disabled
    """
    if not value or not isinstance(value, str):
        return value
    
    # Skip if already encrypted
    if value.startswith('ENC:'):
        return value
    
    fernet = _get_fernet()
    if not fernet:
        return value
    
    try:
        encrypted = fernet.encrypt(value.encode())
        return f"ENC:{encrypted.decode()}"
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return value


def decrypt_field(value: str) -> str:
    """
    Decrypt an encrypted string value
    Returns decrypted string or original if not encrypted
    """
    if not value or not isinstance(value, str):
        return value
    
    # Only decrypt if it's encrypted
    if not value.startswith('ENC:'):
        return value
    
    fernet = _get_fernet()
    if not fernet:
        # Can't decrypt without key - return masked value
        return "***encrypted***"
    
    try:
        encrypted_data = value[4:]  # Remove 'ENC:' prefix
        decrypted = fernet.decrypt(encrypted_data.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return "***decryption_error***"


def encrypt_dict_fields(data: dict, fields: list) -> dict:
    """
    Encrypt specified fields in a dictionary
    Returns new dict with encrypted fields
    """
    result = data.copy()
    for field in fields:
        if field in result and result[field]:
            result[field] = encrypt_field(str(result[field]))
    return result


def decrypt_dict_fields(data: dict, fields: list) -> dict:
    """
    Decrypt specified fields in a dictionary
    Returns new dict with decrypted fields
    """
    if not data:
        return data
    result = dict(data)  # Convert from MongoDB document if needed
    for field in fields:
        if field in result and result[field]:
            result[field] = decrypt_field(str(result[field]))
    return result


# Define which fields to encrypt for each collection
ENCRYPTED_FIELDS = {
    'counsellors': ['name', 'phone', 'sms', 'whatsapp', 'sip_password'],
    'peer_supporters': ['firstName', 'phone', 'sms', 'whatsapp', 'sip_password'],
    'callbacks': ['name', 'phone', 'email', 'message'],
    'notes': ['content', 'subject'],
    'safeguarding_alerts': ['ip_address', 'conversation_history'],
    'live_chat_rooms': ['messages', 'user_name'],  # Chat messages encrypted
    'chat_sessions': ['messages', 'conversation_history'],  # AI chat history encrypted
    'ai_chat_sessions': ['wellbeing_notes', 'case_notes'],  # Supervision notes
    'supervision_notes': ['wellbeing_notes', 'case_notes', 'action_items'],  # HR sensitive
    'escalations': ['description', 'resolution_notes'],  # Escalation details
}


def encrypt_document(collection: str, document: dict) -> dict:
    """Encrypt sensitive fields in a document based on collection"""
    fields = ENCRYPTED_FIELDS.get(collection, [])
    if not fields:
        return document
    return encrypt_dict_fields(document, fields)


def decrypt_document(collection: str, document: dict) -> dict:
    """Decrypt sensitive fields in a document based on collection"""
    fields = ENCRYPTED_FIELDS.get(collection, [])
    if not fields:
        return document
    return decrypt_dict_fields(document, fields)


def generate_encryption_key():
    """Generate a new encryption key (run once during setup)"""
    import secrets
    key = secrets.token_urlsafe(32)
    print(f"New ENCRYPTION_KEY: {key}")
    print("Add this to your .env file: ENCRYPTION_KEY={key}")
    return key


if __name__ == "__main__":
    # Test encryption/decryption
    generate_encryption_key()
