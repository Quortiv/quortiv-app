from fastapi import APIRouter, FastAPI
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from app.core import APP_TITLE, client, db, init_storage_sync, logger
from app.notes_service import ensure_builtin_templates
from app.routers import auth, capture, exports, insights, intelligence, library, notes

app = FastAPI(title=APP_TITLE, version="2.0.0")

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(library.router)
api_router.include_router(notes.router)
api_router.include_router(capture.router)
api_router.include_router(intelligence.router)
api_router.include_router(exports.router)
api_router.include_router(insights.router)


@api_router.get("/")
async def root():
    return {"app": "Quortiv", "status": "ok", "version": "2.0.0"}


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "up"}
    except Exception as e:  # noqa: BLE001
        return {"status": "degraded", "database": "down", "detail": str(e)}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.notes.create_index([("user_id", 1), ("created_at", -1)])
        await db.notes.create_index([("user_id", 1), ("folder_id", 1)])
        await db.notes.create_index([("user_id", 1), ("tags", 1)])
        await db.notes.create_index("share_id", sparse=True)
        await db.folders.create_index([("user_id", 1)])
        await db.templates.create_index([("user_id", 1), ("sort_order", 1)])
        await db.reminders.create_index([("user_id", 1), ("due_at", 1)])
        await db.note_chats.create_index([("user_id", 1), ("note_id", 1), ("created_at", 1)])
        await ensure_builtin_templates()
    except Exception:  # noqa: BLE001
        logger.exception("index/seed startup step failed")
    try:
        await run_in_threadpool(init_storage_sync)
        logger.info("Object storage ready")
    except Exception:  # noqa: BLE001
        logger.exception("object storage init failed")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
