import re
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from ..core import db
from ..deps import get_current_user, resolve_token
from ..docgen import build_markdown, build_pdf, build_text
from ..models import now_utc
from ..notes_service import public_note

router = APIRouter(tags=["export"])


async def _auth(authorization: Optional[str], token: Optional[str]) -> dict:
    """Exports are also opened directly by the browser/OS, where headers are unavailable."""
    if authorization and authorization.startswith("Bearer "):
        return await resolve_token(authorization.replace("Bearer ", "", 1).strip())
    if token:
        return await resolve_token(token)
    raise HTTPException(status_code=401, detail="Authentification requise")


def _slug(title: str) -> str:
    s = re.sub(r"[^\w\s-]", "", (title or "note"), flags=re.UNICODE).strip()
    s = re.sub(r"[\s_]+", "-", s).lower()
    return (s or "note")[:60]


@router.get("/notes/{note_id}/export")
async def export_note(
    note_id: str,
    format: str = Query("pdf", pattern="^(pdf|md|txt)$"),
    include_transcript: bool = True,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    user = await _auth(authorization, token)
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if note.get("status") == "processing":
        raise HTTPException(status_code=409, detail="La note est encore en cours d'analyse")
    if not include_transcript:
        note = {**note, "segments": [], "transcription": ""}
    name = _slug(note.get("title"))

    if format == "pdf":
        content = await run_in_threadpool(build_pdf, note, include_transcript)
        return Response(content=content, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})
    if format == "md":
        return Response(content=build_markdown(note).encode("utf-8"),
                        media_type="text/markdown; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{name}.md"'})
    return Response(content=build_text(note).encode("utf-8"),
                    media_type="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}.txt"'})


@router.get("/notes/{note_id}/plain")
async def note_plain_text(note_id: str, format: str = Query("md", pattern="^(md|txt)$"),
                          user: dict = Depends(get_current_user)):
    """Inline content for native share sheets / clipboard."""
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    content = build_markdown(note) if format == "md" else build_text(note)
    return {"title": note.get("title"), "content": content}


@router.post("/notes/{note_id}/share")
async def create_share_link(note_id: str, include_transcript: bool = True,
                            user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if note.get("status") != "ready":
        raise HTTPException(status_code=409, detail="Seule une note analysée peut être partagée")
    share_id = note.get("share_id") or secrets.token_urlsafe(12)
    await db.notes.update_one({"id": note_id}, {"$set": {
        "share_id": share_id, "share_include_transcript": include_transcript,
        "shared_at": now_utc(), "updated_at": now_utc()}})
    return {"share_id": share_id, "include_transcript": include_transcript}


@router.delete("/notes/{note_id}/share")
async def revoke_share_link(note_id: str, user: dict = Depends(get_current_user)):
    res = await db.notes.update_one({"id": note_id, "user_id": user["user_id"]},
                                    {"$set": {"share_id": None, "updated_at": now_utc()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Note introuvable")
    return {"ok": True}


@router.get("/public/notes/{share_id}")
async def read_shared_note(share_id: str):
    note = await db.notes.find_one({"share_id": share_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Ce lien de partage n'est plus valide")
    data = public_note(note)
    if not note.get("share_include_transcript", True):
        data["segments"] = []
    owner = await db.users.find_one({"user_id": note["user_id"]}, {"_id": 0, "name": 1})
    return {"note": data, "shared_by": (owner or {}).get("name") or "Un utilisateur Quortiv"}


@router.get("/public/notes/{share_id}/export")
async def export_shared_note(share_id: str, format: str = Query("pdf", pattern="^(pdf|md|txt)$")):
    note = await db.notes.find_one({"share_id": share_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Ce lien de partage n'est plus valide")
    include = bool(note.get("share_include_transcript", True))
    if not include:
        note = {**note, "segments": [], "transcription": ""}
    name = _slug(note.get("title"))
    if format == "pdf":
        content = await run_in_threadpool(build_pdf, note, include)
        return Response(content=content, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})
    body = build_markdown(note) if format == "md" else build_text(note)
    media = "text/markdown; charset=utf-8" if format == "md" else "text/plain; charset=utf-8"
    return Response(content=body.encode("utf-8"), media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{name}.{format}"'})
