from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Header, Depends, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import tempfile
import uuid
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import httpx
import requests

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "smartnoter-medical"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="SmartNoter Medical API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Object storage ----------
storage_key: Optional[str] = None


def init_storage_sync():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage_sync()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object_sync(path: str):
    key = init_storage_sync()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Folder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    color: str = "#0066CC"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FolderCreate(BaseModel):
    name: str
    color: Optional[str] = "#0066CC"


class Template(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # None = system template
    name: str
    description: str
    icon: str = "document-text-outline"
    system_prompt: str
    is_default: bool = False
    is_medical: bool = False


class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    audio_path: Optional[str] = None
    duration_sec: int = 0
    language: str = "fr"
    status: str = "processing"  # processing | ready | failed
    transcription: str = ""
    summary: str = ""
    actions: List[str] = []
    plan: List[str] = []
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NoteCreate(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    language: Optional[str] = "fr"


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None
    summary: Optional[str] = None
    transcription: Optional[str] = None


class SessionRequest(BaseModel):
    session_id: str


# ---------- Auth ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.replace("Bearer ", "", 1).strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@api_router.post("/auth/session")
async def auth_session(body: SessionRequest):
    try:
        async with httpx.AsyncClient(timeout=30) as hx:
            r = await hx.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("session-data call failed")
        raise HTTPException(status_code=401, detail="Auth provider unreachable")

    email = data.get("email")
    name = data.get("name")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Missing user data")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = User(user_id=user_id, email=email, name=name, picture=picture).dict()
        await db.users.insert_one(user_doc)
        await seed_user_defaults(user_id)

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
    })

    user_out = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user_out}


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "", 1).strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# Guest / demo login for testing without Google
@api_router.post("/auth/guest")
async def auth_guest():
    email = f"guest_{uuid.uuid4().hex[:8]}@smartnoter.local"
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = User(user_id=user_id, email=email, name="Utilisateur invité").dict()
    await db.users.insert_one(user_doc)
    await seed_user_defaults(user_id)
    session_token = f"guest_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    user_out = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user_out}


# ---------- Seed defaults ----------
DEFAULT_TEMPLATES = [
    {
        "name": "Consultation SOAP",
        "description": "Format médical standard : Subjectif, Objectif, Analyse, Plan",
        "icon": "medkit-outline",
        "is_medical": True,
        "is_default": True,
        "system_prompt": (
            "Vous êtes un assistant médical expert. À partir de la transcription d'une consultation, "
            "produisez un compte-rendu structuré au format SOAP en français. "
            "Renvoyez STRICTEMENT un JSON valide avec les champs suivants : "
            "{\"title\": string court (max 60 car), \"summary\": string en Markdown avec les sections "
            "**Subjectif (S)**, **Objectif (O)**, **Analyse (A)**, **Plan (P)**, "
            "\"actions\": liste de string (prescriptions, examens, rendez-vous), "
            "\"plan\": liste de string (points clés du plan de traitement), "
            "\"tags\": liste de 2-5 mots-clés médicaux}. "
            "N'incluez AUCUN texte hors du JSON."
        ),
    },
    {
        "name": "Consultation rapide",
        "description": "Résumé express d'une consultation patient",
        "icon": "pulse-outline",
        "is_medical": True,
        "system_prompt": (
            "Assistant médical. Produisez un résumé concis d'une consultation à partir de la transcription. "
            "Renvoyez STRICTEMENT un JSON: "
            "{\"title\": string court, \"summary\": string Markdown (motif, symptômes, diagnostic, traitement), "
            "\"actions\": liste (à faire), \"plan\": liste (suivi), \"tags\": liste}."
        ),
    },
    {
        "name": "Réunion classique",
        "description": "Résumé de réunion avec points clés et actions",
        "icon": "people-outline",
        "system_prompt": (
            "Assistant de prise de notes. À partir d'une transcription de réunion, renvoyez STRICTEMENT un JSON: "
            "{\"title\": titre court, \"summary\": résumé Markdown avec points clés et contexte, "
            "\"actions\": liste des tâches et responsables identifiés, "
            "\"plan\": liste des sujets abordés, \"tags\": liste de mots-clés}."
        ),
    },
    {
        "name": "Notes de cours",
        "description": "Structuration académique avec plan et concepts clés",
        "icon": "school-outline",
        "system_prompt": (
            "Assistant pédagogique. Structurez cette transcription de cours. Renvoyez STRICTEMENT un JSON: "
            "{\"title\": titre du cours, \"summary\": résumé Markdown avec concepts et définitions, "
            "\"actions\": liste des à-savoir/à-réviser, \"plan\": liste des chapitres/sections, "
            "\"tags\": liste de mots-clés du domaine}."
        ),
    },
    {
        "name": "Analyse approfondie",
        "description": "Analyse détaillée par IA des sujets abordés",
        "icon": "analytics-outline",
        "system_prompt": (
            "Analyste expert. Effectuez une analyse approfondie de cette transcription. Renvoyez STRICTEMENT un JSON: "
            "{\"title\": titre, \"summary\": analyse Markdown détaillée (contexte, thèmes, insights, "
            "arguments principaux, questions ouvertes), \"actions\": recommandations concrètes, "
            "\"plan\": structure des thèmes, \"tags\": mots-clés analytiques}."
        ),
    },
]


async def seed_user_defaults(user_id: str):
    # Default folders
    default_folders = [
        {"name": "Patients", "color": "#0066CC"},
        {"name": "Réunions", "color": "#10B981"},
        {"name": "Personnel", "color": "#F59E0B"},
    ]
    for f in default_folders:
        folder = Folder(user_id=user_id, name=f["name"], color=f["color"])
        await db.folders.insert_one(folder.dict())
    # Templates already global (see /templates endpoint) - nothing to do


async def ensure_global_templates():
    count = await db.templates.count_documents({"user_id": None})
    if count == 0:
        for t in DEFAULT_TEMPLATES:
            template = Template(user_id=None, **t)
            await db.templates.insert_one(template.dict())
        logger.info("Seeded global templates")


# ---------- Folders ----------
@api_router.get("/folders")
async def list_folders(user: dict = Depends(get_current_user)):
    folders = await db.folders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for f in folders:
        f["note_count"] = await db.notes.count_documents({"user_id": user["user_id"], "folder_id": f["id"]})
    return folders


@api_router.post("/folders")
async def create_folder(body: FolderCreate, user: dict = Depends(get_current_user)):
    folder = Folder(user_id=user["user_id"], name=body.name, color=body.color or "#0066CC")
    await db.folders.insert_one(folder.dict())
    out = folder.dict()
    out["note_count"] = 0
    return out


@api_router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user: dict = Depends(get_current_user)):
    await db.folders.delete_one({"id": folder_id, "user_id": user["user_id"]})
    await db.notes.update_many({"user_id": user["user_id"], "folder_id": folder_id}, {"$set": {"folder_id": None}})
    return {"ok": True}


# ---------- Templates ----------
@api_router.get("/templates")
async def list_templates(user: dict = Depends(get_current_user)):
    templates = await db.templates.find(
        {"$or": [{"user_id": None}, {"user_id": user["user_id"]}]}, {"_id": 0}
    ).to_list(500)
    return templates


# ---------- Notes ----------
@api_router.get("/notes")
async def list_notes(
    folder_id: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {"user_id": user["user_id"]}
    if folder_id and folder_id != "all":
        query["folder_id"] = folder_id
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"transcription": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
        ]
    notes = await db.notes.find(query, {"_id": 0, "transcription": 0}).sort("created_at", -1).to_list(500)
    return notes


@api_router.get("/notes/{note_id}")
async def get_note(note_id: str, user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@api_router.patch("/notes/{note_id}")
async def update_note(note_id: str, body: NoteUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.notes.update_one({"id": note_id, "user_id": user["user_id"]}, {"$set": update})
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    return note


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    await db.notes.delete_one({"id": note_id, "user_id": user["user_id"]})
    return {"ok": True}


@api_router.get("/notes/{note_id}/audio")
async def get_note_audio(note_id: str, token: Optional[str] = None,
                        authorization: Optional[str] = Header(None)):
    # Auth via header or ?token= query
    if not authorization and token:
        authorization = f"Bearer {token}"
    user = await get_current_user(authorization=authorization)
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note or not note.get("audio_path"):
        raise HTTPException(status_code=404, detail="Audio not found")
    try:
        content, ctype = await run_in_threadpool(get_object_sync, note["audio_path"])
    except Exception as e:
        logger.exception("audio fetch failed")
        raise HTTPException(status_code=500, detail="Storage error")
    return Response(content=content, media_type=ctype)


# ---------- Transcribe + summarize ----------
def _clean_json_response(text: str) -> dict:
    """Extract JSON from LLM response that may contain code fences."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
    return json.loads(text)


async def _summarize(transcription: str, system_prompt: str, language: str) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"summary-{uuid.uuid4().hex[:10]}",
        system_message=system_prompt,
    ).with_model("anthropic", "claude-sonnet-5")
    lang_line = "Réponds en français." if language == "fr" else "Answer in English."
    user_msg = UserMessage(text=f"{lang_line}\n\nTranscription:\n\"\"\"\n{transcription}\n\"\"\"")
    resp = await chat.send_message(user_msg)
    try:
        data = _clean_json_response(resp)
    except Exception as e:
        logger.warning(f"JSON parse failed, using fallback: {e}")
        data = {
            "title": (transcription[:50] or "Nouvelle note").strip(),
            "summary": resp,
            "actions": [],
            "plan": [],
            "tags": [],
        }
    return data


@api_router.post("/notes/upload")
async def upload_and_process(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    template_id: Optional[str] = Form(None),
    language: str = Form("fr"),
    duration_sec: int = Form(0),
    user: dict = Depends(get_current_user),
):
    filename = file.filename or "audio.m4a"
    ext = Path(filename).suffix.lower().lstrip(".") or "m4a"
    if ext not in {"m4a", "mp3", "wav", "mp4", "mpeg", "mpga", "webm"}:
        raise HTTPException(status_code=415, detail=f"Unsupported audio format: {ext}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Max 25 MB")

    # Create note with processing status immediately
    note_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/uploads/{user['user_id']}/{note_id}.{ext}"

    # Store audio
    try:
        await run_in_threadpool(put_object_sync, storage_path, data, file.content_type or "audio/mp4")
    except Exception as e:
        logger.exception("upload to storage failed")
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")

    note_doc = Note(
        id=note_id,
        user_id=user["user_id"],
        title=title or "Nouvelle note",
        folder_id=folder_id,
        template_id=template_id,
        audio_path=storage_path,
        duration_sec=duration_sec,
        language=language,
        status="processing",
    ).dict()
    await db.notes.insert_one(note_doc)

    # Transcribe with Whisper via emergentintegrations
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        resp = await stt.transcribe(
            file=tmp_path,
            model="whisper-1",
            response_format="json",
            language=language if language in {"fr", "en", "es", "de", "it", "pt", "nl"} else None,
        )
        text = getattr(resp, "text", None) or (resp.get("text") if isinstance(resp, dict) else str(resp))
    except Exception as e:
        logger.exception("whisper transcribe failed")
        await db.notes.update_one({"id": note_id}, {"$set": {"status": "failed", "summary": f"Erreur transcription: {e}"}})
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    # Get template
    template = None
    if template_id:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        template = await db.templates.find_one({"is_default": True}, {"_id": 0})
    if not template:
        template = {"system_prompt": DEFAULT_TEMPLATES[0]["system_prompt"], "name": "Default"}

    try:
        summary_data = await _summarize(text, template["system_prompt"], language)
    except Exception as e:
        logger.exception("summary failed")
        summary_data = {"title": title or "Nouvelle note", "summary": "Erreur d'analyse IA.", "actions": [], "plan": [], "tags": []}

    final_title = title or summary_data.get("title") or "Nouvelle note"
    update = {
        "title": final_title[:120],
        "transcription": text,
        "summary": summary_data.get("summary", ""),
        "actions": summary_data.get("actions", []) or [],
        "plan": summary_data.get("plan", []) or [],
        "tags": summary_data.get("tags", []) or [],
        "template_name": template.get("name"),
        "status": "ready",
        "updated_at": datetime.now(timezone.utc),
    }
    await db.notes.update_one({"id": note_id}, {"$set": update})
    note = await db.notes.find_one({"id": note_id}, {"_id": 0})
    return note


class TextNoteCreate(BaseModel):
    title: Optional[str] = None
    text: str
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    language: str = "fr"


@api_router.post("/notes/from-text")
async def create_from_text(body: TextNoteCreate, user: dict = Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    template = None
    if body.template_id:
        template = await db.templates.find_one({"id": body.template_id}, {"_id": 0})
    if not template:
        template = await db.templates.find_one({"is_default": True}, {"_id": 0})

    try:
        summary_data = await _summarize(body.text, template["system_prompt"], body.language)
    except Exception as e:
        logger.exception("summary failed")
        summary_data = {"title": body.title or "Note", "summary": "Erreur IA.", "actions": [], "plan": [], "tags": []}

    note = Note(
        user_id=user["user_id"],
        title=(body.title or summary_data.get("title") or "Note texte")[:120],
        folder_id=body.folder_id,
        template_id=body.template_id,
        template_name=template.get("name") if template else None,
        language=body.language,
        status="ready",
        transcription=body.text,
        summary=summary_data.get("summary", ""),
        actions=summary_data.get("actions", []) or [],
        plan=summary_data.get("plan", []) or [],
        tags=summary_data.get("tags", []) or [],
    )
    await db.notes.insert_one(note.dict())
    return note.dict()


# ---------- Stats ----------
@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    total = await db.notes.count_documents({"user_id": user["user_id"]})
    folders = await db.folders.count_documents({"user_id": user["user_id"]})
    total_dur = 0
    async for n in db.notes.find({"user_id": user["user_id"]}, {"duration_sec": 1, "_id": 0}):
        total_dur += n.get("duration_sec", 0) or 0
    return {"total_notes": total, "total_folders": folders, "total_duration_sec": total_dur}


@api_router.get("/")
async def root():
    return {"message": "SmartNoter API"}


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.notes.create_index([("user_id", 1), ("created_at", -1)])
        await db.folders.create_index([("user_id", 1)])
        await ensure_global_templates()
        await run_in_threadpool(init_storage_sync)
        logger.info("Storage initialized")
    except Exception as e:
        logger.exception(f"Startup task failed: {e}")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
