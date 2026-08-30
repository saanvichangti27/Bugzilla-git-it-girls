"""
AI service using Google GenAI SDK (google-genai).
Phase 3 Features:
  1. Bug Summarization
  2. Duplicate Bug Detection
  3. Auto-Suggest Bug Fields (component, priority, severity)
"""
import json
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger("ai_service")

# Allowed values for field suggestion validation
ALLOWED_COMPONENTS = {"frontend", "backend", "database", "others"}
ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}
ALLOWED_SEVERITIES = {"trivial", "minor", "major", "critical", "blocker"}

MODEL_NAME = "gemini-3.6-flash"


class DuplicateResult(BaseModel):
    is_duplicate: bool = Field(description="True if the new bug is a duplicate of an existing open bug")
    duplicate_of_id: Optional[str] = Field(None, description="The ID of the existing duplicate bug if is_duplicate is True")
    reason: Optional[str] = Field(None, description="Short explanation of why it is considered a duplicate")


class SuggestedFields(BaseModel):
    component: str = Field(description="Suggested component: frontend, backend, database, or others")
    priority: str = Field(description="Suggested priority: low, medium, high, or critical")
    severity: str = Field(description="Suggested severity: trivial, minor, major, critical, or blocker")


def _get_genai_client():
    """Returns a Google GenAI client instance if GEMINI_API_KEY is set."""
    import os
    from pathlib import Path
    from dotenv import load_dotenv

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        _env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        load_dotenv(dotenv_path=_env_path, override=True)
        api_key = os.getenv("GEMINI_API_KEY", "")

    if not api_key:
        from app.config import settings
        api_key = settings.GEMINI_API_KEY or ""

    if not api_key:
        logger.warning("[AI SERVICE] GEMINI_API_KEY is not set.")
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as exc:
        logger.error(f"[AI SERVICE] Failed to initialize google-genai client: {exc!r}")
        return None



def generate_bug_summary(title: str, description: str, comments: List[Dict[str, Any]]) -> Optional[str]:
    """
    Summarize a bug report and its discussion in 2-3 sentences.
    Returns the summary string or None if generation fails.
    """
    try:
        client = _get_genai_client()
        if not client:
            return None

        # Build context from title, description, and comments
        comments_text = ""
        if comments:
            comments_text = "\nDiscussion:\n" + "\n".join(
                f"- {c.get('author_name', 'User')}: {c.get('content', '')}" for c in comments
            )

        prompt = (
            "Summarize this bug report and its discussion in 2-3 sentences for someone triaging it.\n\n"
            f"Title: {title}\n"
            f"Description: {description}"
            f"{comments_text}"
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )

        if response and response.text:
            summary = response.text.strip()
            logger.info("[AI SERVICE] Successfully generated bug summary.")
            return summary

        return None

    except Exception as exc:
        logger.error(f"[AI SERVICE] generate_bug_summary failed: {exc!r}")
        return None




def detect_duplicate_bug(title: str, description: str, open_bugs: List[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """
    Check if the new bug (title + description) is a duplicate of any recent open bugs.
    Returns dict {"bug_id": str, "reason": str} if a duplicate is found, else None.
    """
    if not open_bugs:
        return None

    try:
        client = _get_genai_client()
        if not client:
            return None

        from google.genai import types

        # Build list of existing open bugs for context
        bugs_context = []
        for b in open_bugs[:50]:  # Limit to 50 open bugs
            bugs_context.append({
                "id": str(b.get("id", "")),
                "title": b.get("title", ""),
                "description": b.get("description", ""),
            })

        prompt = (
            "Analyze the new bug report below and determine if it is a duplicate of any existing open bug listed.\n\n"
            f"NEW BUG:\nTitle: {title}\nDescription: {description}\n\n"
            f"EXISTING OPEN BUGS:\n{json.dumps(bugs_context, indent=2)}"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DuplicateResult,
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=config,
        )

        if not response or not response.text:
            return None

        # Parse structured JSON response
        data = json.loads(response.text)
        is_dup = data.get("is_duplicate", False)
        dup_id = data.get("duplicate_of_id")
        reason = data.get("reason", "Possible duplicate detected")

        if is_dup and dup_id:
            # Verify the duplicate ID actually exists in the provided list
            valid_ids = {str(b.get("id")) for b in open_bugs}
            if dup_id in valid_ids:
                logger.info(f"[AI SERVICE] Duplicate detected: bug {dup_id}")
                return {"bug_id": dup_id, "reason": reason}

        return None

    except Exception as exc:
        logger.error(f"[AI SERVICE] detect_duplicate_bug failed: {exc!r}")
        return None


def suggest_bug_fields(title: str, description: str) -> Optional[Dict[str, str]]:
    """
    Suggest component, priority, and severity for a bug report based on title and description.
    Validates suggestions against allowed enums and uses sensible fallbacks if invalid.
    """
    try:
        client = _get_genai_client()
        if not client:
            return None

        from google.genai import types

        prompt = (
            "Analyze the bug report title and description. Suggest the appropriate component, priority, and severity.\n\n"
            f"Title: {title}\n"
            f"Description: {description}\n\n"
            "Allowed components: frontend, backend, database, others\n"
            "Allowed priorities: low, medium, high, critical\n"
            "Allowed severities: trivial, minor, major, critical, blocker"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SuggestedFields,
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=config,
        )

        if not response or not response.text:
            return None

        data = json.loads(response.text)

        # Extract and validate fields against allowed values with fallbacks
        raw_component = str(data.get("component", "")).lower().strip()
        raw_priority = str(data.get("priority", "")).lower().strip()
        raw_severity = str(data.get("severity", "")).lower().strip()

        component = raw_component if raw_component in ALLOWED_COMPONENTS else "others"
        priority = raw_priority if raw_priority in ALLOWED_PRIORITIES else "medium"
        severity = raw_severity if raw_severity in ALLOWED_SEVERITIES else "minor"

        logger.info(f"[AI SERVICE] Suggested fields: component='{component}', priority='{priority}', severity='{severity}'")

        return {
            "component": component,
            "priority": priority,
            "severity": severity,
        }

    except Exception as exc:
        logger.error(f"[AI SERVICE] suggest_bug_fields failed: {exc!r}")
        return None
