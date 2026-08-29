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
        self.events_db: Dict[str, dict] = {}
        self.webhook_logs_db: Dict[str, dict] = {}
        self.users_db: Dict[str, dict] = {}
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
        
        # Seed users
        self.users_db["user-reporter-id"] = {
            "id": "user-reporter-id",
            "name": "Test Reporter User",
            "email": "reporter@example.com",
            "role": "reporter",
            "created_at": now.isoformat()
        }
        self.users_db["user-developer-id"] = {
            "id": "user-developer-id",
            "name": "Test Developer User",
            "email": "developer@example.com",
            "role": "developer",
            "created_at": now.isoformat()
        }
        self.users_db["user-admin-id"] = {
            "id": "user-admin-id",
            "name": "Test Admin User",
            "email": "admin@example.com",
            "role": "admin",
            "created_at": now.isoformat()
        }

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

    # --- EVENT METHODS ---
    def create_event(self, event_type: str, bug_id: Optional[str], payload: dict) -> dict:
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": event_id,
            "event_type": event_type,
            "bug_id": bug_id,
            "payload_json": payload,
            "processed": False,
            "created_at": now
        }
        
        if self.use_supabase:
            try:
                res = self.client.table("events").insert(doc).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] create_event failed: {e}. Falling back to memory.")
        
        self.events_db[event_id] = doc
        return doc

    def get_unprocessed_events(self) -> List[dict]:
        if self.use_supabase:
            try:
                res = self.client.table("events").select("*").eq("processed", False).order("created_at", desc=False).execute()
                return res.data or []
            except Exception as e:
                print(f"[SUPABASE ERROR] get_unprocessed_events failed: {e}. Falling back to memory.")
        
        return [e for e in self.events_db.values() if not e["processed"]]

    def mark_event_processed(self, event_id: str) -> None:
        if self.use_supabase:
            try:
                self.client.table("events").update({"processed": True}).eq("id", event_id).execute()
            except Exception as e:
                print(f"[SUPABASE ERROR] mark_event_processed failed: {e}. Falling back to memory.")
        
        if event_id in self.events_db:
            self.events_db[event_id]["processed"] = True

    def get_events(
        self,
        event_type: Optional[str] = None,
        processed: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[dict], int]:
        if self.use_supabase:
            try:
                query = self.client.table("events").select("*", count="exact")
                if event_type:
                    query = query.eq("event_type", event_type)
                if processed is not None:
                    query = query.eq("processed", processed)
                
                query = query.order("created_at", desc=True)
                start = (page - 1) * page_size
                end = start + page_size - 1
                res = query.range(start, end).execute()
                total = res.count if res.count is not None else len(res.data)
                return res.data, total
            except Exception as e:
                print(f"[SUPABASE ERROR] get_events failed: {e}. Falling back to memory.")

        items = list(self.events_db.values())
        if event_type:
            items = [i for i in items if i["event_type"] == event_type]
        if processed is not None:
            items = [i for i in items if i["processed"] == processed]
        
        total = len(items)
        items.sort(key=lambda x: x["created_at"], reverse=True)
        start = (page - 1) * page_size
        paginated = items[start:start + page_size]
        return paginated, total

    # --- WEBHOOK LOG METHODS ---
    def create_webhook_log(self, event_type: str, destination: str, status_code: Optional[int], success: bool) -> dict:
        log_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": log_id,
            "event_type": event_type,
            "destination": destination,
            "status_code": status_code,
            "success": success,
            "created_at": now
        }
        
        if self.use_supabase:
            try:
                res = self.client.table("webhook_logs").insert(doc).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] create_webhook_log failed: {e}. Falling back to memory.")
        
        self.webhook_logs_db[log_id] = doc
        return doc

    def get_webhook_logs(
        self,
        destination: Optional[str] = None,
        success: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[dict], int]:
        if self.use_supabase:
            try:
                query = self.client.table("webhook_logs").select("*", count="exact")
                if destination:
                    query = query.eq("destination", destination)
                if success is not None:
                    query = query.eq("success", success)
                
                query = query.order("created_at", desc=True)
                start = (page - 1) * page_size
                end = start + page_size - 1
                res = query.range(start, end).execute()
                total = res.count if res.count is not None else len(res.data)
                return res.data, total
            except Exception as e:
                print(f"[SUPABASE ERROR] get_webhook_logs failed: {e}. Falling back to memory.")

        items = list(self.webhook_logs_db.values())
        if destination:
            items = [i for i in items if i["destination"] == destination]
        if success is not None:
            items = [i for i in items if i["success"] == success]
        
        total = len(items)
        items.sort(key=lambda x: x["created_at"], reverse=True)
        start = (page - 1) * page_size
        paginated = items[start:start + page_size]
        return paginated, total

    # --- USER METHODS ---
    def create_user(self, user_id: str, name: str, email: str, role: str = "reporter") -> dict:
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "created_at": now
        }
        
        if self.use_supabase:
            try:
                res = self.client.table("users").insert(doc).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] create_user failed: {e}. Falling back to memory.")

        self.users_db[user_id] = doc
        return doc
        
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        if self.use_supabase:
            try:
                res = self.client.table("users").select("*").eq("id", user_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] get_user_by_id failed: {e}. Falling back to memory.")
        return self.users_db.get(user_id)

    def search_users(self, search: Optional[str]) -> List[dict]:
        if self.use_supabase:
            try:
                query = self.client.table("users").select("*")
                if search:
                    query = query.ilike("name", f"%{search}%")
                res = query.execute()
                return res.data or []
            except Exception as e:
                print(f"[SUPABASE ERROR] search_users failed: {e}. Falling back to memory.")
        
        users = list(self.users_db.values())
        if search:
            search = search.lower()
            users = [u for u in users if search in u.get("name", "").lower()]
        return users

    def update_user_role(self, user_id: str, new_role: str) -> Optional[dict]:
        if self.use_supabase:
            try:
                res = self.client.table("users").update({"role": new_role}).eq("id", user_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE ERROR] update_user_role failed: {e}. Falling back to memory.")
        
        if user_id in self.users_db:
            self.users_db[user_id]["role"] = new_role
            return self.users_db[user_id]
        return None

    # --- DASHBOARD METHODS ---
    def get_dashboard_summary(self, user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        start_of_week = now.date().isoformat() # Approximating to avoid complex date math in sqlite/mem
        
        if self.use_supabase:
            try:
                open_bugs = self.client.table("bugs").select("id", count="exact").in_("status", ["new", "in_progress"]).execute().count
                assigned = self.client.table("bugs").select("id", count="exact").eq("assignee_id", user_id).in_("status", ["new", "in_progress"]).execute().count
                resolved = self.client.table("bugs").select("id", count="exact").eq("status", "resolved").gte("updated_at", start_of_week).execute().count
                
                return {
                    "open_bugs": open_bugs or 0,
                    "assigned_to_me": assigned or 0,
                    "resolved_this_week": resolved or 0
                }
            except Exception as e:
                print(f"[SUPABASE ERROR] get_dashboard_summary failed: {e}. Falling back to memory.")
        
        bugs = list(self.bugs_db.values())
        open_bugs = len([b for b in bugs if b.get("status") in ["new", "in_progress"]])
        assigned = len([b for b in bugs if b.get("assignee_id") == user_id and b.get("status") in ["new", "in_progress"]])
        resolved = len([b for b in bugs if b.get("status") == "resolved" and b.get("updated_at", "") >= start_of_week])
        
        return {
            "open_bugs": open_bugs,
            "assigned_to_me": assigned,
            "resolved_this_week": resolved
        }

db = Database()
