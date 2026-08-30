import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly resolve the .env file next to this package (backend/.env)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)


class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-jwt-key-for-dev")
    API_PREFIX: str = "/api/v1"
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    GITHUB_REPO: str = os.getenv("GITHUB_REPO", "")
    BACKEND_PUBLIC_URL: str = os.getenv("BACKEND_PUBLIC_URL", "http://127.0.0.1:8000")
    DISCORD_WEBHOOK_URL: str = os.getenv("DISCORD_WEBHOOK_URL", "")
    DISCORD_CREATED_WEBHOOK_URL: str = os.getenv("DISCORD_CREATED_WEBHOOK_URL", "")
    DISCORD_RESOLVED_WEBHOOK_URL: str = os.getenv("DISCORD_RESOLVED_WEBHOOK_URL", "")

    # GitHub Integration (Phase 2)
    GITHUB_PAT: str = os.getenv("GITHUB_PAT", "")
    GITHUB_REPO_OWNER: str = os.getenv("GITHUB_REPO_OWNER", "")
    GITHUB_REPO_NAME: str = os.getenv("GITHUB_REPO_NAME", "")
    GITHUB_WEBHOOK_SECRET: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    APP_FRONTEND_URL: str = os.getenv("APP_FRONTEND_URL", "http://localhost:5173")

    # Gemini AI Integration (Phase 3)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Email / Notification Integration (Priority 2)
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    NOTIFY_FROM_EMAIL: str = os.getenv("NOTIFY_FROM_EMAIL", "notifications@bugzilla-modern.app")

settings = Settings()
