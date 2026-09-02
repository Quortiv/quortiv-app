import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..core import db, get_object_sync, logger
from ..deps import get_current_user, resolve_token
from ..models import NoteUpdate, now_utc

router = APIRouter(tags=["notes"])

LIST_PROJECTION = {"_id": 0, "transcription": 0, "segments": 0, "translations": 0}


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("/notes")
async def list_notes(
    folder_id: Optional[str] = None,
    q: Optional[str] = None,
    status: Optional[str] = None,
    source_type: Optional[str] = None,
    tag: Optional[str] = None,
    favorite: Optional[bool] = None,
    archived: bool = False,
    period: Optional[str] = Query(None, description="today | week | month"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: str = Query("recent", description="recent | oldest | title | duration"),
    limit: int = Query(30, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    query: dict = {"user_id": user["user_id"]}
    query["archived"] = True if archived else {"$ne": True}
    if folder_id and folder_id != "all":
        query["folder_id"] = None if folder_id == "unsorted" else folder_id
    if status and status != "all":
        query["status"] = status
    if source_type and source_type != "all":
        query["source_type"] = source_type
    if tag:
        query["tags"] = tag
    if favorite:
        query["favorite"] = True

    start = _parse_date(date_from)
    end = _parse_date(date_to)
    if period:
        now = now_utc()
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start = now - timedelta(days=7)
        elif period == "month":
            start = now - timedelta(days=30)
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        query["created_at"] = rng

    if q and q.strip():
        rx = re.escape(q.strip())
        query["$or"] = [
            {"title": {"$regex": rx, "$options": "i"}},
            {"summary": {"$regex": rx, "$options": "i"}},
            {"transcription": {"$regex": rx, "$options": "i"}},
            {"tags": {"$regex": rx, "$options": "i"}},
        ]

    sort_map = {
        "recent": [("created_at", -1)],
        "oldest": [("created_at", 1)],
        "title": [("title", 1)],
        "duration": [("duration_sec", -1)],
    }
    total = await db.notes.count_documents(query)
    cursor = db.notes.find(query, LIST_PROJECTION).sort(sort_map.get(sort, sort_map["recent"]))
    items = await cursor.skip(skip).limit(limit).to_list(limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit,
            "has_more": skip + len(items) < total}


@router.get("/tags")
async def list_tags(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"], "archived": {"$ne": True}}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1, "_id": 1}},
        {"$limit": 60},
    ]
    rows = await db.notes.aggregate(pipeline).to_list(60)
    return [{"tag": r["_id"], "count": r["count"]} for r in rows]


@router.get("/notes/{note_id}")
async def get_note(note_id: str, user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    return note


@router.patch("/notes/{note_id}")
async def update_note(note_id: str, body: NoteUpdate, user: dict = Depends(get_current_user)):
    update = body.dict(exclude_none=True)
    if "actions" in update:
        update["actions"] = [a if isinstance(a, dict) else a.dict() for a in update["actions"]]
    if "segments" in update:
        update["segments"] = [s if isinstance(s, dict) else s.dict() for s in update["segments"]]
    if "tags" in update:
        update["tags"] = [str(t).strip().lower() for t in update["tags"] if str(t).strip()][:12]
    if "title" in update:
        update["title"] = update["title"].strip()[:120] or "Note"
    if "folder_id" in update and update["folder_id"] in ("", "unsorted"):
        update["folder_id"] = None
    if not update:
        raise HTTPException(status_code=400, detail="Aucune modification fournie")
    update["updated_at"] = now_utc()
    res = await db.notes.update_one({"id": note_id, "user_id": user["user_id"]}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Note introuvable")
    return await db.notes.find_one({"id": note_id}, {"_id": 0})


class BulkRequest(BaseModel):
    note_ids: List[str]
    action: str  # delete | archive | unarchive | favorite | unfavorite | move
    folder_id: Optional[str] = None


@router.post("/notes/bulk")
async def bulk_notes(body: BulkRequest, user: dict = Depends(get_current_user)):
    if not body.note_ids:
        raise HTTPException(status_code=400, detail="Aucune note sélectionnée")
    flt = {"id": {"$in": body.note_ids}, "user_id": user["user_id"]}
    if body.action == "delete":
        res = await db.notes.delete_many(flt)
        await db.reminders.delete_many({"note_id": {"$in": body.note_ids}, "user_id": user["user_id"]})
        return {"ok": True, "affected": res.deleted_count}
    sets = {
        "archive": {"archived": True},
        "unarchive": {"archived": False},
        "favorite": {"favorite": True},
        "unfavorite": {"favorite": False},
        "move": {"folder_id": body.folder_id if body.folder_id not in ("", "unsorted") else None},
    }
    if body.action not in sets:
        raise HTTPException(status_code=400, detail="Action inconnue")
    res = await db.notes.update_many(flt, {"$set": {**sets[body.action], "updated_at": now_utc()}})
    return {"ok": True, "affected": res.modified_count}


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    res = await db.notes.delete_one({"id": note_id, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Note introuvable")
    await db.reminders.delete_many({"note_id": note_id, "user_id": user["user_id"]})
    await db.note_chats.delete_many({"note_id": note_id, "user_id": user["user_id"]})
    return {"ok": True}


@router.get("/notes/{note_id}/audio")
async def get_note_audio(note_id: str, token: Optional[str] = None,
                         authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        user = await resolve_token(authorization.replace("Bearer ", "", 1).strip())
    elif token:
        user = await resolve_token(token)
    else:
        raise HTTPException(status_code=401, detail="Authentification requise")
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note or not note.get("audio_path"):
        raise HTTPException(status_code=404, detail="Aucun média associé")
    try:
        content, ctype = await run_in_threadpool(get_object_sync, note["audio_path"])
    except Exception:  # noqa: BLE001
        logger.exception("audio fetch failed")
        raise HTTPException(status_code=502, detail="Média temporairement indisponible")
    return Response(content=content, media_type=note.get("media_mime") or ctype,
                    headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"})


@router.get("/notes/{note_id}/related")
async def related_notes(note_id: str, user: dict = Depends(get_current_user)):
    """Knowledge links: notes sharing tags, folder or title keywords."""
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    tags = set(note.get("tags") or [])
    words = {w.lower() for w in re.findall(r"\w{5,}", note.get("title") or "")}
    others = await db.notes.find(
        {"user_id": user["user_id"], "id": {"$ne": note_id}, "archived": {"$ne": True}},
        {"_id": 0, "id": 1, "title": 1, "tags": 1, "folder_id": 1, "created_at": 1,
         "source_type": 1, "status": 1, "duration_sec": 1},
    ).sort("created_at", -1).to_list(300)

    scored = []
    for o in others:
        shared = tags & set(o.get("tags") or [])
        score = len(shared) * 3
        if note.get("folder_id") and o.get("folder_id") == note.get("folder_id"):
            score += 1
        title_words = {w.lower() for w in re.findall(r"\w{5,}", o.get("title") or "")}
        overlap = words & title_words
        score += len(overlap) * 2
        if score > 0:
            scored.append({**o, "score": score, "shared_tags": sorted(shared)})
    scored.sort(key=lambda x: (-x["score"], x["title"]))
    return scored[:8]
