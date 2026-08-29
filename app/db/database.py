import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from app.config import settings
from app.schemas.bug import BugResponse, BugListItem, UserSummary, StatusEnum, PriorityEnum, SeverityEnum
from app.schemas.comment import CommentResponse

class Database:
    def __init__(self):
        self.use_supabase = bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY))
        self.client = None

        if self.use_supabase:
            try:
                from supabase import create_client
                key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
                self.client = create_client(settings.SUPABASE_URL, key)
            except Exception as e:
                print(f"[DB WARN] Failed to initialize Supabase client: {e}. Falling back to memory DB.")
                self.use_supabase = False

        # In-memory storage for standalone local execution / tests
        self.bugs_db: Dict[str, dict] = {}
        self.comments_db: Dict[str, List[dict]] = {}
        self._seed_data()

    def _seed_data(self):
        # Sample seed bug
        bug_id = "11111111-1111-1111-1111-111111111111"
        now = datetime.now(timezone.utc)
        self.bugs_db[bug_id] = {
            "id": bug_id,
            "title": "Login button unresponsive on Safari",
            "description": "Steps to reproduce: 1. Open Safari 17. 2. Click login.",
            "status": "new",
            "priority": "high",
            "severity": "major",
            "component": "auth-ui",
            "assignee_id": None,
            "assignee_name": None,
            "reporter_id": "user-reporter-id",
            "reporter_name": "Asha Rao",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "github_issue_id": None,
            "github_issue_url": None,
            "ai_summary": None,
            "ai_summary_generated_at": None,
        }
        self.comments_db[bug_id] = [
            {
                "id": "c1111111-1111-1111-1111-111111111111",
                "bug_id": bug_id,
                "body": "Initial observation: reproduces only on Safari 17.2",
                "user_id": "user-developer-id",
                "user_name": "Dev User",
                "created_at": now.isoformat(),
            }
        ]

    # --- BUG METHODS ---
    def create_bug(self, bug_data: dict, reporter: UserSummary) -> dict:
        bug_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        doc = {
            "id": bug_id,
            "title": bug_data["title"],
            "description": bug_data["description"],
            "status": StatusEnum.NEW.value,
            "priority": bug_data["priority"],
            "severity": bug_data["severity"],
            "component": bug_data["component"],
            "assignee_id": bug_data.get("assignee_id"),
            "assignee_name": bug_data.get("assignee_name"),
            "reporter_id": reporter.id,
            "reporter_name": reporter.name,
            "created_at": now,
            "updated_at": now,
            "github_issue_id": None,
            "github_issue_url": None,
            "ai_summary": None,
            "ai_summary_generated_at": None,
        }

        if self.use_supabase:
            try:
                res = self.client.table("bugs").insert(doc).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] create_bug failed: {e}. Falling back to memory.")

        self.bugs_db[bug_id] = doc
        return doc

    def get_bug(self, bug_id: str) -> Optional[dict]:
        if self.use_supabase:
            try:
                res = self.client.table("bugs").select("*").eq("id", bug_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] get_bug failed: {e}. Falling back to memory.")

        return self.bugs_db.get(bug_id)

    def get_bugs(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        severity: Optional[str] = None,
        component: Optional[str] = None,
        assignee_id: Optional[str] = None,
        reporter_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        sort: Optional[str] = "-created_at"
    ) -> Tuple[List[dict], int]:
        if self.use_supabase:
            try:
                query = self.client.table("bugs").select("*", count="exact")
                if status:
                    query = query.eq("status", status)
                if priority:
                    query = query.eq("priority", priority)
                if severity:
                    query = query.eq("severity", severity)
                if component:
                    query = query.eq("component", component)
                if assignee_id:
                    query = query.eq("assignee_id", assignee_id)
                if reporter_id:
                    query = query.eq("reporter_id", reporter_id)

                # Sorting
                if sort:
                    desc = sort.startswith("-")
                    col = sort.lstrip("-")
                    query = query.order(col, desc=desc)

                # Pagination
                start = (page - 1) * page_size
                end = start + page_size - 1
                res = query.range(start, end).execute()
                total = res.count if res.count is not None else len(res.data)
                return res.data, total
            except Exception as e:
                print(f"[SUPABASE ERROR] get_bugs failed: {e}. Falling back to memory.")

        # In-memory search & filter
        items = list(self.bugs_db.values())
        if status:
            items = [b for b in items if b.get("status") == status]
        if priority:
            items = [b for b in items if b.get("priority") == priority]
        if severity:
            items = [b for b in items if b.get("severity") == severity]
        if component:
            items = [b for b in items if b.get("component") == component]
        if assignee_id:
            items = [b for b in items if b.get("assignee_id") == assignee_id]
        if reporter_id:
            items = [b for b in items if b.get("reporter_id") == reporter_id]

        total = len(items)

        # Sort
        if sort:
            desc = sort.startswith("-")
            col = sort.lstrip("-")
            items.sort(key=lambda x: x.get(col, ""), reverse=desc)

        start = (page - 1) * page_size
        end = start + page_size
        paginated = items[start:end]
        return paginated, total

    def update_bug(self, bug_id: str, updates: dict) -> Optional[dict]:
        existing = self.get_bug(bug_id)
        if not existing:
            return None

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        if self.use_supabase:
            try:
                res = self.client.table("bugs").update(updates).eq("id", bug_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] update_bug failed: {e}. Falling back to memory.")

        existing.update(updates)
        self.bugs_db[bug_id] = existing
        return existing

    # --- COMMENT METHODS ---
    def get_comments(self, bug_id: str) -> List[dict]:
        if self.use_supabase:
            try:
                res = self.client.table("comments").select("*").eq("bug_id", bug_id).order("created_at", desc=False).execute()
                return res.data or []
            except Exception as e:
                print(f"[SUPABASE ERROR] get_comments failed: {e}. Falling back to memory.")

        return self.comments_db.get(bug_id, [])

    def create_comment(self, bug_id: str, body: str, user: UserSummary) -> dict:
        comment_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": comment_id,
            "bug_id": bug_id,
            "body": body,
            "user_id": user.id,
            "user_name": user.name,
            "created_at": now
        }

        if self.use_supabase:
            try:
                res = self.client.table("comments").insert(doc).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] create_comment failed: {e}. Falling back to memory.")

        if bug_id not in self.comments_db:
            self.comments_db[bug_id] = []
        self.comments_db[bug_id].append(doc)
        return doc

db = Database()
