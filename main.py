import os
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_ANON_KEY")

if not url or not key:
    raise RuntimeError("Supabase credentials not found in .env file")

supabase: Client = create_client(url, key)

# Initialize FastAPI App
app = FastAPI(title="Bugzilla Modernization API")

# Setup CORS (allows frontend to talk to your backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models for Validation ---
class AuthRequest(BaseModel):
    email: str
    password: str
    name: str = None # Name is needed for signup, optional for login

class RoleUpdateRequest(BaseModel):
    role: str

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

# --- Helper to get user from token ---
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    
    try:
        # Verify token with Supabase
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
             raise HTTPException(status_code=401, detail="Invalid token")
        return user_res.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# --- Auth Endpoints ---

@app.post("/api/v1/auth/signup", status_code=201)
def signup(req: AuthRequest):
    try:
        # Supabase handles creating the user and hashing the password safely!
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {
                    "name": req.name,
                    "role": "reporter" # Default role
                }
            }
        })
        
        return {
            "data": {
                "user": res.user.model_dump(),
                "token": res.session.access_token if res.session else None
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "SIGNUP_FAILED", "message": str(e)})


@app.post("/api/v1/auth/login")
def login(req: AuthRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })
        return {
            "data": {
                "user": res.user.model_dump(),
                "token": res.session.access_token
            },
            "error": None
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail={"code": "INVALID_CREDENTIALS", "message": str(e)})


@app.get("/api/v1/auth/me")
def get_me(current_user = Depends(get_current_user)):
    # We successfully decoded the token via get_current_user
    return {
        "data": current_user.model_dump(),
        "error": None
    }


# --- Dashboard Endpoint (Read-Only queries to 'bugs' table) ---

@app.get("/api/v1/dashboard/summary")
def get_dashboard_summary(current_user = Depends(get_current_user)):
    user_id = current_user.id
    try:
        # 1. Count Open Bugs
        open_bugs_res = supabase.table("bugs").select("*", count="exact").neq("status", "closed").execute()
        
        # 2. Count bugs assigned to the current user
        assigned_res = supabase.table("bugs").select("*", count="exact").eq("assignee_id", user_id).execute()
        
        return {
            "data": {
                "open_bugs": open_bugs_res.count if open_bugs_res.count else 0,
                "assigned_to_me": assigned_res.count if assigned_res.count else 0,
                "resolved_this_week": 0 # (Keep it 0 for now until you add date filtering)
            },
            "error": None
        }
    except Exception as e:
        # If the 'bugs' table doesn't exist yet, this will error. 
        # But this code is ready for when Person A creates the table!
        raise HTTPException(status_code=500, detail={"code": "DB_ERROR", "message": str(e)})
# --- User Role Management Endpoints (Phase 2) ---

# We need an admin client to manage other users' roles
service_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin: Client = create_client(url, service_key) if service_key else None

@app.get("/api/v1/users")
def get_all_users(current_user = Depends(get_current_user)):
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Service Role Key missing in .env")
        
    # Get all users from Supabase Auth
    users_data = supabase_admin.auth.admin.list_users()
    
    formatted_users = []
    for u in users_data:
        # Extract role from user metadata
        role = u.user_metadata.get("role", "reporter") if u.user_metadata else "reporter"
        name = u.user_metadata.get("name", "Unknown") if u.user_metadata else "Unknown"
        
        formatted_users.append({
            "id": u.id,
            "email": u.email,
            "name": name,
            "role": role
        })
        
    return {"data": formatted_users, "error": None}


@app.patch("/api/v1/users/{user_id}/role")
def update_user_role(user_id: str, req: RoleUpdateRequest, current_user = Depends(get_current_user)):
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Service Role Key missing in .env")
        
    # 1. Security Check: Only admins can change roles
    current_user_role = current_user.user_metadata.get("role", "reporter") if current_user.user_metadata else "reporter"
    if current_user_role != "admin":
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only admins can change roles"})
        
    # 2. Update the user's role in Supabase Auth metadata
    try:
        updated_user = supabase_admin.auth.admin.update_user_by_id(
            user_id, 
            {"user_metadata": {"role": req.role}}
        )
        return {"data": {"message": f"Role updated to {req.role}"}, "error": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
