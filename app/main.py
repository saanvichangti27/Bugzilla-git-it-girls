from fastapi import FastAPI, Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.routers import bugs, comments, events, webhook_logs, auth, users, dashboard
from app.services.dispatcher import start_dispatcher

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_dispatcher()
    yield

app = FastAPI(
    title="Bugzilla Modernization Platform",
    description="Bugs and Comments REST API with strict role-based authorization",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handlers to enforce standard response envelope format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "ERROR"
    message = str(exc.detail)
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "ERROR")
        message = exc.detail.get("message", str(exc.detail))
    elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
        code = "UNAUTHORIZED"
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        code = "FORBIDDEN"
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        code = "NOT_FOUND"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "data": None,
            "error": {
                "code": code,
                "message": message
            }
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = "; ".join([f"{'->'.join(map(str, err['loc']))}: {err['msg']}" for err in errors])
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "data": None,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"Validation failed: {msg}"
            }
        }
    )

# Root endpoint for health check
@app.get("/")
def root():
    return {
        "service": "Bugzilla Modernization Platform",
        "status": "running",
        "testing_ui": "/ui",
        "api_docs": "/docs",
        "api_v1_bugs": f"{settings.API_PREFIX}/bugs"
    }

from os.path import exists
from fastapi.responses import FileResponse

@app.get("/ui", include_in_schema=False)
@app.get("/app", include_in_schema=False)
def serve_ui():
    if exists("static/index.html"):
        return FileResponse("static/index.html")
    return JSONResponse({"message": "Testing UI template not found"})

# Mount Person A & C routers under /api/v1
app.include_router(bugs.router, prefix=settings.API_PREFIX)
app.include_router(comments.router, prefix=settings.API_PREFIX)
app.include_router(events.router, prefix=settings.API_PREFIX)
app.include_router(webhook_logs.router, prefix=settings.API_PREFIX)

# Mount Person B routers under /api/v1
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(users.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
