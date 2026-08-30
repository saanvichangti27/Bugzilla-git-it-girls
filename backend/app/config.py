import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-jwt-key-for-dev")
    API_PREFIX: str = "/api/v1"

    # GitHub Integration (Phase 2)
    GITHUB_PAT: str = os.getenv("GITHUB_PAT", "")
    GITHUB_REPO_OWNER: str = os.getenv("GITHUB_REPO_OWNER", "")
    GITHUB_REPO_NAME: str = os.getenv("GITHUB_REPO_NAME", "")
    GITHUB_WEBHOOK_SECRET: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    APP_FRONTEND_URL: str = os.getenv("APP_FRONTEND_URL", "http://localhost:5173")


settings = Settings()
