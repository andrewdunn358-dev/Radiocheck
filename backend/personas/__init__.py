"""
Personas Package - Modular AI Character System
==============================================

This module provides a centralized system for loading and managing AI character personas.
Each character has:
- A unique prompt defining their personality and behavior
- The Soul Document rules injected for consistent behavior across all personas

Usage:
    from personas import get_character_config, get_full_prompt, AI_CHARACTERS
    
    # Get character config
    config = get_character_config("tommy")
    
    # Get full prompt with soul injection
    prompt = get_full_prompt("tommy")
    
    # Access all characters
    for char_id, char_data in AI_CHARACTERS.items():
        print(char_data["name"])
"""

import os
from typing import Dict, Optional

# Import the soul document loader
from .soul_loader import get_soul_injection, build_persona_prompt

# Import all persona modules
from . import tommy
from . import rachel
from . import finch
from . import bob
from . import margie
from . import jack
from . import rita
from . import catherine
from . import frankie
from . import baz
from . import megan
from . import penny
from . import alex
from . import sam
from . import kofi
from . import james
from . import dave
from . import mo
from . import helen
from . import reg

# Avatar base URL (dynamically set based on environment)
def get_avatar_base_url() -> str:
    """Get the avatar base URL from environment or use default."""
    backend_url = os.getenv("REACT_APP_BACKEND_URL", "")
    if backend_url:
        return f"{backend_url}/api/avatars"
    return "/api/avatars"


# Build the master character registry
def _build_characters_dict() -> Dict[str, Dict]:
    """
    Build the AI_CHARACTERS dictionary from all persona modules.
    Maps internal IDs to character configurations.
    """
    avatar_base = get_avatar_base_url()
    
    # List of all persona modules with their data
    personas = [
        tommy.PERSONA,
        rachel.PERSONA,
        finch.PERSONA,
        bob.PERSONA,
        margie.PERSONA,
        jack.PERSONA,
        rita.PERSONA,
        catherine.PERSONA,
        frankie.PERSONA,
        baz.PERSONA,
        megan.PERSONA,
        penny.PERSONA,
        alex.PERSONA,
        sam.PERSONA,
        kofi.PERSONA,
        james.PERSONA,
        dave.PERSONA,
        mo.PERSONA,
        helen.PERSONA,
        reg.PERSONA,
    ]
    
    characters = {}
    for persona in personas:
        char_id = persona["id"]
        
        # Extract avatar filename from persona avatar path
        avatar_filename = persona.get("avatar", "").split("/")[-1]
        if not avatar_filename:
            avatar_filename = f"{char_id}.png"
        
        characters[char_id] = {
            "name": persona["name"],
            "prompt": persona["prompt"],
            "avatar": f"{avatar_base}/{avatar_filename}",
            "role": persona.get("role", "Support"),
            "accent_color": persona.get("accent_color", "#3b82f6"),
        }
    
    return characters


# Build the characters dict at module load time
AI_CHARACTERS = _build_characters_dict()


def get_character_config(character_id: str) -> Optional[Dict]:
    """
    Get the configuration for a specific character.
    
    Args:
        character_id: The internal ID of the character (e.g., "tommy", "doris")
        
    Returns:
        Character configuration dict or None if not found
    """
    return AI_CHARACTERS.get(character_id)


def get_full_prompt(character_id: str, include_soul: bool = True) -> str:
    """
    Get the full system prompt for a character, optionally including the Soul Document.
    
    Args:
        character_id: The internal ID of the character
        include_soul: Whether to prepend the Soul Document rules (default True)
        
    Returns:
        The complete system prompt string
    """
    config = get_character_config(character_id)
    if not config:
        # Fall back to Tommy if character not found
        config = AI_CHARACTERS.get("tommy", {})
    
    persona_prompt = config.get("prompt", "")
    
    if include_soul:
        return build_persona_prompt(persona_prompt)
    
    return persona_prompt


def get_all_character_ids() -> list:
    """Get a list of all available character IDs."""
    return list(AI_CHARACTERS.keys())


def get_all_characters() -> Dict[str, Dict]:
    """Get the full AI_CHARACTERS dictionary."""
    return AI_CHARACTERS


def refresh_avatar_urls():
    """
    Refresh avatar URLs if the environment has changed.
    Call this after environment variables are loaded.
    """
    global AI_CHARACTERS
    AI_CHARACTERS = _build_characters_dict()


# Mapping for any legacy ID conversions
LEGACY_ID_MAP = {
    # "old_id": "new_id"
    # doris -> doris (kept for Rachel)
    # sentry -> sentry (kept for Finch)
}


def resolve_character_id(character_id: str) -> str:
    """
    Resolve a character ID, handling any legacy mappings.
    
    Args:
        character_id: The character ID (possibly legacy)
        
    Returns:
        The current character ID
    """
    return LEGACY_ID_MAP.get(character_id, character_id)
