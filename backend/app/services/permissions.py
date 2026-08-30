import logging
from typing import Dict, List, Set, Tuple
from app.db.database import db

logger = logging.getLogger("permissions")

# Cache structures
_role_permissions_cache: Dict[str, Set[str]] = {}  # Map of role -> set of editable fields
_status_transitions_cache: Dict[str, Set[Tuple[str, str]]] = {}  # Map of role -> set of (from_status, to_status)

def reload_permissions_cache():
    """Reloads the permissions from the database into memory."""
    global _role_permissions_cache
    global _status_transitions_cache
    
    logger.info("[PERMISSIONS] Reloading permissions cache...")
    
    # Reload role permissions
    raw_rp = db.get_role_permissions()
    new_rp_cache: Dict[str, Set[str]] = {}
    for row in raw_rp:
        role = row["role"]
        field = row["field"]
        editable = row.get("editable", False)
        
        if role not in new_rp_cache:
            new_rp_cache[role] = set()
            
        if editable:
            new_rp_cache[role].add(field)
            
    _role_permissions_cache = new_rp_cache
    
    # Reload status transitions
    raw_st = db.get_status_transitions()
    new_st_cache: Dict[str, Set[Tuple[str, str]]] = {}
    for row in raw_st:
        role = row["role"]
        from_status = row["from_status"]
        to_status = row["to_status"]
        
        if role not in new_st_cache:
            new_st_cache[role] = set()
            
        new_st_cache[role].add((from_status, to_status))
        
    _status_transitions_cache = new_st_cache
    logger.info("[PERMISSIONS] Cache reload complete.")

def can_edit_field(role: str, field: str) -> bool:
    """Checks if a role is permitted to edit a specific field."""
    # Ensure cache is loaded
    if not _role_permissions_cache and not _status_transitions_cache:
        reload_permissions_cache()
        
    allowed_fields = _role_permissions_cache.get(role.lower(), set())
    return field in allowed_fields

def can_transition(role: str, from_status: str, to_status: str) -> bool:
    """Checks if a role is permitted to transition a bug from one status to another."""
    # Ensure cache is loaded
    if not _role_permissions_cache and not _status_transitions_cache:
        reload_permissions_cache()
        
    role_key = role.lower()
    
    # If the role is not in the transition table AT ALL, they are unrestricted 
    # (assuming they have the field permission to edit status in the first place)
    if role_key not in _status_transitions_cache:
        return True
        
    allowed_transitions = _status_transitions_cache.get(role_key, set())
    
    # Check exact match
    if (from_status, to_status) in allowed_transitions:
        return True
        
    # Check wildcard match
    if ("*", to_status) in allowed_transitions:
        return True
        
    return False

# Initialize cache immediately on import if possible
# (It relies on db being ready, which it is since db = Database() runs at module load)
try:
    reload_permissions_cache()
except Exception as e:
    logger.warning(f"Failed to prime permissions cache on startup: {e}")
