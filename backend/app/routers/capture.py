import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, UploadFile)
from starlette.concurrency import run_in_threadpool

from .. import ai
from ..core import (APP_SLUG, MAX_DOCUMENT_BYTES, MAX_MEDIA_BYTES, db, logger,
                    put_object_sync)
from ..deps import get_current_user
from ..extract import DOCUMENT_EXTS, extract_document, extract_url
from ..models import (DraftCreate, Note, TextNoteCreate, UrlNoteCreate,
                      new_id, now_utc)
from ..notes_service import analyse_and_store, pref, resolve_template

router = APIRouter(tags=["capture"])

MEDIA_EXTS = {"m4a", "mp3", "wav", "mp4", "mpeg", "mpga", "webm", "aac", "ogg", "flac", "mov", "m4v"}
VIDEO_EXTS = {"mp4", "mov", "webm", "m4v", "mpeg"}

MIME_BY_EXT = {
    "m4a": "audio/mp4", "mp3": "audio/mpeg", "wav": "audio/wav", "aac": "audio/aac",
    "ogg": "audio/ogg", "flac": "audio/flac", "mp4": "video/mp4", "mov": "video/quicktime",
    "webm": "audio/webm", "m4v": "video/x-m4v", "mpeg": "audio/mpeg", "mpga": "audio/mpeg",
}


def _ext_of(filename: str, fallback: str = "m4a") -> str:
    return (Path(filename or "").suffix.lower().lstrip(".") or fallback)


async def _store_media(user_id: str, note_id: str, ext: str, data: bytes, mime: str) -> str:
    path = f"{APP_SLUG}/media/{user_id}/{note_id}.{ext}"
    await run_in_threadpool(put_object_sync, path, data, mime)
    return path


async def _transcribe_bytes(data: bytes, ext: str, language: str) -> dict:
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return await ai.transcribe_file(tmp_path, language)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ------------------------------------------------------------------ live recording
@router.post("/notes/draft")
async def create_draft(body: DraftCreate, user: dict = Depends(get_current_user)):
    tpl = await resolve_template(user["user_id"], body.template_id, user)
    note = Note(
        user_id=user["user_id"],
        title=(body.title or "Enregistrement en cours").strip()[:120],
        folder_id=body.folder_id or pref(user, "default_folder_id", None),
        template_id=(tpl or {}).get("id"),
        template_name=(tpl or {}).get("name"),
        source_type="recording",
        language=body.language or pref(user, "language", "fr"),
        status="processing",
    )
    await db.notes.insert_one(note.dict())
    return note.dict()


@router.post("/notes/{note_id}/chunk")
async def transcribe_chunk(
    note_id: str,
    file: UploadFile = File(...),
    offset_sec: float = Form(0),
    language: str = Form("fr"),
    user: dict = Depends(get_current_user),
):
    """Near-real-time transcription: each recorded slice is transcribed and appended."""
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Segment audio vide")
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="Segment trop volumineux")
    ext = _ext_of(file.filename, "m4a")
    try:
        result = await _transcribe_bytes(data, ext, language)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"chunk transcription failed: {e}")
        raise HTTPException(status_code=502, detail="Transcription du segment indisponible")

    new_segments = [{**s, "start": round(s["start"] + offset_sec, 2),
                     "end": round(s["end"] + offset_sec, 2)} for s in result["segments"]]
    if not new_segments:
        return {"text": "", "segments": [], "transcription": note.get("transcription", "")}
    merged_text = (note.get("transcription", "") + " " + result["text"]).strip()
    await db.notes.update_one(
        {"id": note_id},
        {"$push": {"segments": {"$each": new_segments}},
         "$set": {"transcription": merged_text, "updated_at": now_utc()}},
    )
    return {"text": result["text"], "segments": new_segments, "transcription": merged_text}


async def _finalize_pipeline(note_id: str, user: dict, language: str, level: str,
                             template: Optional[dict], fallback_title: str,
                             source_hint: str, diarization: bool, media: Optional[dict] = None):
    try:
        note = await db.notes.find_one({"id": note_id}, {"_id": 0})
        if not note:
            return
        transcription = note.get("transcription") or ""
        segments = note.get("segments") or []

        if media:
            try:
                path = await _store_media(user["user_id"], note_id, media["ext"], media["data"], media["mime"])
                await db.notes.update_one({"id": note_id},
                                          {"$set": {"audio_path": path, "media_mime": media["mime"]}})
            except Exception as e:  # noqa: BLE001
                logger.warning(f"media storage failed: {e}")

            if not transcription.strip():
                result = await _transcribe_bytes(media["data"], media["ext"], language)
                transcription = result["text"]
                segments = result["segments"]
                dur = int(result.get("duration") or 0)
                await db.notes.update_one({"id": note_id}, {"$set": {
                    "transcription": transcription, "segments": segments,
                    **({"duration_sec": dur} if dur else {}),
                }})

        if not transcription.strip():
            await db.notes.update_one({"id": note_id}, {"$set": {
                "status": "failed",
                "error": "Aucune parole détectée dans l'audio. Vérifiez le micro ou le fichier importé.",
                "updated_at": now_utc()}})
            return

        if diarization and len(segments) > 2:
            diar = await ai.diarize(segments)
            if diar.get("assignments"):
                segments = ai.apply_diarization(segments, diar)
                await db.notes.update_one({"id": note_id}, {"$set": {
                    "segments": segments, "speakers": diar.get("labels") or {}}})

        await analyse_and_store(note_id, transcription, template, language, level,
                                source_hint, fallback_title)
    except Exception as e:  # noqa: BLE001
        logger.exception("finalize pipeline crashed")
        await db.notes.update_one({"id": note_id}, {"$set": {
            "status": "failed", "error": f"Traitement interrompu : {e}", "updated_at": now_utc()}})


@router.post("/notes/{note_id}/finalize")
async def finalize_recording(
    note_id: str,
    background: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    duration_sec: int = Form(0),
    template_id: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")

    media = None
    if file is not None:
        data = await file.read()
        if data:
            if len(data) > MAX_MEDIA_BYTES:
                raise HTTPException(status_code=413, detail="Enregistrement trop volumineux (25 Mo max)")
            ext = _ext_of(file.filename, "m4a")
            media = {"data": data, "ext": ext,
                     "mime": file.content_type or MIME_BY_EXT.get(ext, "audio/mp4")}

    lang = language or note.get("language") or pref(user, "language", "fr")
    tpl = await resolve_template(user["user_id"], template_id or note.get("template_id"), user)
    set_fields = {"duration_sec": duration_sec or note.get("duration_sec", 0),
                  "language": lang, "status": "processing", "error": None,
                  "template_id": (tpl or {}).get("id"), "template_name": (tpl or {}).get("name"),
                  "updated_at": now_utc()}
    if folder_id:
        set_fields["folder_id"] = None if folder_id in ("", "unsorted") else folder_id
    await db.notes.update_one({"id": note_id}, {"$set": set_fields})

    background.add_task(_finalize_pipeline, note_id, user, lang,
                        pref(user, "summary_level", "standard"), tpl,
                        (title or "Enregistrement").strip()[:120], "enregistrement audio en direct",
                        bool(pref(user, "diarization", True)), media)
    return await db.notes.find_one({"id": note_id}, {"_id": 0})


@router.delete("/notes/{note_id}/draft")
async def discard_draft(note_id: str, user: dict = Depends(get_current_user)):
    await db.notes.delete_one({"id": note_id, "user_id": user["user_id"], "summary": ""})
    return {"ok": True}


# ------------------------------------------------------------------ media import
@router.post("/notes/upload")
async def upload_media(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    template_id: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    duration_sec: int = Form(0),
    user: dict = Depends(get_current_user),
):
    ext = _ext_of(file.filename, "m4a")
    if ext not in MEDIA_EXTS:
        raise HTTPException(status_code=415,
                            detail=f"Format non pris en charge : .{ext}. Formats acceptés : "
                                   + ", ".join(sorted(MEDIA_EXTS)))
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413,
                            detail="Fichier trop volumineux (25 Mo max). Découpez-le ou compressez-le.")

    lang = language or pref(user, "language", "fr")
    tpl = await resolve_template(user["user_id"], template_id, user)
    is_video = ext in VIDEO_EXTS
    note = Note(
        user_id=user["user_id"],
        title=(title or Path(file.filename or "Import").stem or "Import").strip()[:120],
        folder_id=folder_id if folder_id not in ("", "unsorted", None) else pref(user, "default_folder_id", None),
        template_id=(tpl or {}).get("id"), template_name=(tpl or {}).get("name"),
        source_type="video" if is_video else "audio",
        source_name=file.filename, duration_sec=duration_sec, language=lang,
        media_mime=file.content_type or MIME_BY_EXT.get(ext),
        status="processing",
    )
    await db.notes.insert_one(note.dict())

    background.add_task(
        _finalize_pipeline, note.id, user, lang, pref(user, "summary_level", "standard"), tpl,
        note.title, "piste audio extraite d'une vidéo" if is_video else "fichier audio importé",
        bool(pref(user, "diarization", True)),
        {"data": data, "ext": ext, "mime": note.media_mime or "audio/mp4"},
    )
    return note.dict()


# ------------------------------------------------------------------ documents
@router.post("/notes/from-document")
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    template_id: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    ext = _ext_of(file.filename, "txt")
    if ext not in DOCUMENT_EXTS:
        raise HTTPException(status_code=415,
                            detail=f"Format non pris en charge : .{ext}. Formats acceptés : "
                                   + ", ".join(sorted(DOCUMENT_EXTS)))
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Document trop volumineux (15 Mo max)")

    try:
        text = await run_in_threadpool(extract_document, data, ext)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422,
                            detail=f"Document illisible ou corrompu (.{ext}). {str(e)[:120]}")
    if len(text.strip()) < 40:
        raise HTTPException(status_code=422,
                            detail="Aucun texte exploitable extrait. Le document est peut-être scanné en image.")

    lang = language or pref(user, "language", "fr")
    tpl = await resolve_template(user["user_id"], template_id, user)
    note = Note(
        user_id=user["user_id"],
        title=(title or Path(file.filename or "Document").stem).strip()[:120],
        folder_id=folder_id if folder_id not in ("", "unsorted", None) else pref(user, "default_folder_id", None),
        template_id=(tpl or {}).get("id"), template_name=(tpl or {}).get("name"),
        source_type="document", source_name=file.filename, language=lang,
        status="processing", transcription=text, word_count=len(text.split()),
        segments=[{"start": 0, "end": 0, "text": text[:200000], "speaker": None}],
    )
    await db.notes.insert_one(note.dict())
    background.add_task(analyse_and_store, note.id, text, tpl, lang,
                        pref(user, "summary_level", "standard"),
                        f"document importé ({ext.upper()})", note.title)
    return note.dict()


# ------------------------------------------------------------------ text
@router.post("/notes/from-text")
async def create_from_text(body: TextNoteCreate, background: BackgroundTasks,
                           user: dict = Depends(get_current_user)):
    text = body.text.strip()
    if len(text) < 5:
        raise HTTPException(status_code=400, detail="Le texte est trop court")
    lang = body.language or pref(user, "language", "fr")
    tpl = await resolve_template(user["user_id"], body.template_id, user)
    source_type = body.source_type if body.source_type in {"text", "meeting"} else "text"
    note = Note(
        user_id=user["user_id"],
        title=(body.title or text[:60]).strip()[:120],
        folder_id=body.folder_id if body.folder_id not in ("", "unsorted", None) else pref(user, "default_folder_id", None),
        template_id=(tpl or {}).get("id"), template_name=(tpl or {}).get("name"),
        source_type=source_type, language=lang,
        transcription=text, word_count=len(text.split()),
        segments=[{"start": 0, "end": 0, "text": text[:200000], "speaker": None}],
        status="processing" if body.analyze else "ready",
    )
    await db.notes.insert_one(note.dict())
    if body.analyze:
        background.add_task(analyse_and_store, note.id, text, tpl, lang,
                            pref(user, "summary_level", "standard"),
                            "notes saisies manuellement", note.title,
                            bool(body.title))
    return note.dict()


# ------------------------------------------------------------------ url
@router.post("/notes/from-url")
async def create_from_url(body: UrlNoteCreate, background: BackgroundTasks,
                          user: dict = Depends(get_current_user)):
    extracted = await extract_url(body.url.strip())
    lang = body.language or pref(user, "language", "fr")
    tpl = await resolve_template(user["user_id"], body.template_id, user)
    text = extracted["text"]
    note = Note(
        user_id=user["user_id"],
        title=(body.title or extracted["title"]).strip()[:120],
        folder_id=body.folder_id if body.folder_id not in ("", "unsorted", None) else pref(user, "default_folder_id", None),
        template_id=(tpl or {}).get("id"), template_name=(tpl or {}).get("name"),
        source_type="url", source_url=body.url.strip(), source_name=extracted["title"],
        language=lang, status="processing", transcription=text, word_count=len(text.split()),
        segments=[{"start": 0, "end": 0, "text": text[:200000], "speaker": None}],
    )
    await db.notes.insert_one(note.dict())
    background.add_task(analyse_and_store, note.id, text, tpl, lang,
                        pref(user, "summary_level", "standard"),
                        "contenu importé depuis un lien web", note.title)
    return note.dict()
