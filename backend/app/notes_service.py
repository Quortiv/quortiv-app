"""Shared note pipeline helpers."""
from typing import Any, Dict, List, Optional

from . import ai
from .core import db, logger
from .models import Folder, Template, new_id, now_utc
from .templates_seed import BUILTIN_TEMPLATES

DEFAULT_FOLDERS = [
    {"name": "Travail", "color": "#2E5BFF", "icon": "briefcase-outline"},
    {"name": "Personnel", "color": "#10B981", "icon": "person-outline"},
    {"name": "Idées", "color": "#F59E0B", "icon": "bulb-outline"},
]


async def seed_user_defaults(user_id: str) -> None:
    existing = await db.folders.count_documents({"user_id": user_id})
    if existing:
        return
    for f in DEFAULT_FOLDERS:
        await db.folders.insert_one(Folder(user_id=user_id, **f).dict())


async def ensure_builtin_templates() -> None:
    for t in BUILTIN_TEMPLATES:
        await db.templates.update_one(
            {"user_id": None, "name": t["name"]},
            {"$set": {**t, "is_builtin": True, "user_id": None},
             "$setOnInsert": {"id": new_id(), "created_at": now_utc()}},
            upsert=True,
        )
    # remove built-ins no longer in the catalogue
    names = [t["name"] for t in BUILTIN_TEMPLATES]
    await db.templates.delete_many({"user_id": None, "name": {"$nin": names}})
    logger.info("Built-in templates synchronised")


async def resolve_template(user_id: str, template_id: Optional[str], user: Optional[dict] = None) -> Optional[dict]:
    tpl = None
    if template_id:
        tpl = await db.templates.find_one(
            {"id": template_id, "$or": [{"user_id": None}, {"user_id": user_id}]}, {"_id": 0})
    if not tpl and user:
        pref = (user.get("prefs") or {}).get("default_template_id")
        if pref:
            tpl = await db.templates.find_one(
                {"id": pref, "$or": [{"user_id": None}, {"user_id": user_id}]}, {"_id": 0})
    if not tpl:
        tpl = await db.templates.find_one({"user_id": None}, {"_id": 0}, sort=[("sort_order", 1)])
    return tpl


def pref(user: dict, key: str, fallback: Any) -> Any:
    return (user.get("prefs") or {}).get(key, fallback) or fallback


async def analyse_and_store(note_id: str, content: str, template: Optional[dict], language: str,
                            level: str, source_hint: str, fallback_title: str,
                            keep_title: bool = False) -> dict:
    """Run the AI restitution and persist it. Always leaves the note in a terminal state."""
    try:
        data = await ai.summarize(content, template, language, level, source_hint)
        actions = [{"id": new_id(), "done": False, **a} for a in data["actions"]]
        title = fallback_title if keep_title else (data.get("title") or fallback_title)
        update = {
            "title": (title or "Note")[:120],
            "summary": data["summary"],
            "key_points": data["key_points"],
            "decisions": data["decisions"],
            "actions": actions,
            "plan": data["plan"],
            "insights": data["insights"],
            "tags": data["tags"],
            "summary_level": level,
            "template_id": (template or {}).get("id"),
            "template_name": (template or {}).get("name"),
            "status": "ready",
            "error": None,
            "word_count": len(content.split()),
            "updated_at": now_utc(),
        }
    except Exception as e:  # noqa: BLE001
        logger.exception("analysis failed")
        update = {
            "status": "failed",
            "error": f"L'analyse IA a échoué : {e}",
            "updated_at": now_utc(),
        }
    await db.notes.update_one({"id": note_id}, {"$set": update})
    return await db.notes.find_one({"id": note_id}, {"_id": 0})


async def note_context(note: dict, limit: int = 40000) -> str:
    parts: List[str] = []
    if note.get("summary"):
        parts.append(f"RESTITUTION:\n{note['summary']}")
    if note.get("key_points"):
        parts.append("POINTS CLÉS:\n" + "\n".join(f"- {p}" for p in note["key_points"]))
    if note.get("decisions"):
        parts.append("DÉCISIONS:\n" + "\n".join(f"- {d}" for d in note["decisions"]))
    if note.get("actions"):
        parts.append("ACTIONS:\n" + "\n".join(f"- {a.get('text','')}" for a in note["actions"]))
    if note.get("transcription"):
        parts.append(f"TRANSCRIPTION:\n{note['transcription']}")
    return "\n\n".join(parts)[:limit]


def public_note(note: Dict[str, Any]) -> Dict[str, Any]:
    keys = ("id", "title", "summary", "key_points", "decisions", "actions", "plan",
            "insights", "tags", "template_name", "created_at", "duration_sec",
            "segments", "speakers", "source_type")
    return {k: note.get(k) for k in keys}
