import re
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from .. import ai
from ..core import db, logger
from ..deps import get_current_user
from ..models import ChatRequest, ReprocessRequest, TranslateRequest, new_id, now_utc
from ..notes_service import analyse_and_store, note_context, pref, resolve_template

router = APIRouter(tags=["intelligence"])


@router.post("/notes/{note_id}/reprocess")
async def reprocess_note(note_id: str, body: ReprocessRequest, background: BackgroundTasks,
                         user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if not (note.get("transcription") or "").strip():
        raise HTTPException(status_code=422, detail="Cette note n'a pas de contenu à réanalyser")
    tpl = await resolve_template(user["user_id"], body.template_id or note.get("template_id"), user)
    level = body.summary_level or note.get("summary_level") or pref(user, "summary_level", "standard")
    if level not in {"brief", "standard", "deep"}:
        raise HTTPException(status_code=400, detail="Niveau de détail invalide")
    lang = body.language or note.get("language") or "fr"
    await db.notes.update_one({"id": note_id}, {"$set": {"status": "processing", "error": None,
                                                         "language": lang, "updated_at": now_utc()}})
    background.add_task(analyse_and_store, note_id, note["transcription"], tpl, lang, level,
                        f"réanalyse ({note.get('source_type')})", note.get("title") or "Note", True)
    return {"ok": True, "status": "processing", "template_id": (tpl or {}).get("id"),
            "summary_level": level}


async def _run_translation(note_id: str, target: str, scope: str, note: dict):
    try:
        payload = {}
        if scope in {"summary", "both"}:
            payload["summary"] = await ai.translate_text(note.get("summary") or "", target)
            payload["key_points"] = [await ai.translate_text(p, target) for p in (note.get("key_points") or [])[:20]]
        if scope in {"transcription", "both"}:
            payload["transcription"] = await ai.translate_text(note.get("transcription") or "", target)
        payload["translated_at"] = now_utc().isoformat()
        await db.notes.update_one({"id": note_id}, {"$set": {
            f"translations.{target}": payload, "translation_status": "ready", "updated_at": now_utc()}})
    except Exception as e:  # noqa: BLE001
        logger.exception("translation failed")
        await db.notes.update_one({"id": note_id}, {"$set": {
            "translation_status": "failed", "translation_error": str(e)}})


@router.post("/notes/{note_id}/translate")
async def translate_note(note_id: str, body: TranslateRequest, background: BackgroundTasks,
                         user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    target = body.target_lang.lower()
    if target not in ai.LANG_NAMES:
        raise HTTPException(status_code=400, detail="Langue non prise en charge")
    if target == (note.get("language") or "fr"):
        raise HTTPException(status_code=400, detail="La note est déjà dans cette langue")
    existing = (note.get("translations") or {}).get(target)
    if existing and body.scope == "summary" and existing.get("summary"):
        return {"ok": True, "status": "ready", "cached": True}
    await db.notes.update_one({"id": note_id}, {"$set": {"translation_status": "processing"}})
    background.add_task(_run_translation, note_id, target, body.scope, note)
    return {"ok": True, "status": "processing", "target_lang": target}


@router.get("/notes/{note_id}/chat")
async def get_chat(note_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.note_chats.find(
        {"user_id": user["user_id"], "note_id": note_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return msgs


@router.delete("/notes/{note_id}/chat")
async def clear_chat(note_id: str, user: dict = Depends(get_current_user)):
    await db.note_chats.delete_many({"user_id": user["user_id"], "note_id": note_id})
    return {"ok": True}


@router.get("/notes/{note_id}/suggestions")
async def note_suggestions(note_id: str, user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": user["user_id"]},
                                   {"_id": 0, "title": 1, "summary": 1, "language": 1, "suggestions": 1})
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if note.get("suggestions"):
        return note["suggestions"]
    if not (note.get("summary") or "").strip():
        return []
    questions = await ai.suggest_questions(note.get("title") or "", note["summary"],
                                           note.get("language") or "fr")
    if questions:
        await db.notes.update_one({"id": note_id}, {"$set": {"suggestions": questions}})
    return questions


@router.post("/notes/{note_id}/chat")
async def chat_with_note(note_id: str, body: ChatRequest, user: dict = Depends(get_current_user)):
    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message vide")
    ids = body.note_ids or [note_id]
    notes = await db.notes.find({"id": {"$in": ids}, "user_id": user["user_id"]}, {"_id": 0}).to_list(10)
    if not notes:
        raise HTTPException(status_code=404, detail="Note introuvable")

    contexts = [{"id": n["id"], "title": n.get("title") or "Note",
                 "content": await note_context(n)} for n in notes]
    history = await db.note_chats.find(
        {"user_id": user["user_id"], "note_id": note_id}, {"_id": 0, "role": 1, "content": 1}
    ).sort("created_at", 1).to_list(20)

    user_msg = {"id": new_id(), "user_id": user["user_id"], "note_id": note_id,
                "role": "user", "content": question, "created_at": now_utc()}
    await db.note_chats.insert_one(dict(user_msg))

    try:
        answer = await ai.ask_notes(question, contexts, history,
                                    notes[0].get("language") or pref(user, "language", "fr"))
    except Exception as e:  # noqa: BLE001
        logger.exception("note chat failed")
        raise HTTPException(status_code=502, detail=f"L'assistant est momentanément indisponible : {e}")

    cited = [n["id"] for n in notes if (n.get("title") or "") and n["title"] in answer] or [n["id"] for n in notes]
    assistant_msg = {"id": new_id(), "user_id": user["user_id"], "note_id": note_id,
                     "role": "assistant", "content": answer, "citations": cited,
                     "created_at": now_utc()}
    await db.note_chats.insert_one(dict(assistant_msg))
    user_msg.pop("_id", None)
    assistant_msg.pop("_id", None)
    return {"user_message": user_msg, "message": assistant_msg}


# ------------------------------------------------------------------ smart search
class SmartSearchRequest(BaseModel):
    query: str
    limit: int = 20


@router.post("/search/smart")
async def smart_search(body: SmartSearchRequest, user: dict = Depends(get_current_user)):
    """Hybrid search: LLM query expansion + weighted keyword ranking over the user's notes."""
    q = body.query.strip()
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Requête trop courte")

    terms = [q.lower()]
    try:
        terms += await ai.expand_query(q)
    except Exception as e:  # noqa: BLE001
        logger.info(f"query expansion unavailable, keyword-only search: {e}")
    terms = list(dict.fromkeys([t for t in terms if len(t) > 2]))[:8]

    notes = await db.notes.find(
        {"user_id": user["user_id"], "archived": {"$ne": True}},
        {"_id": 0, "id": 1, "title": 1, "summary": 1, "transcription": 1, "tags": 1,
         "key_points": 1, "created_at": 1, "source_type": 1, "status": 1,
         "duration_sec": 1, "folder_id": 1, "template_name": 1, "favorite": 1},
    ).sort("created_at", -1).to_list(1000)

    results = []
    for n in notes:
        title = (n.get("title") or "").lower()
        summary = (n.get("summary") or "").lower()
        transcript = (n.get("transcription") or "").lower()
        tags = " ".join(n.get("tags") or []).lower()
        score, matched, snippet = 0, [], ""
        for i, term in enumerate(terms):
            weight = 1.0 if i == 0 else 0.55
            hits = 0
            if term in title:
                score += 10 * weight; hits += 1
            if term in tags:
                score += 6 * weight; hits += 1
            c = summary.count(term)
            if c:
                score += min(c, 5) * 3 * weight; hits += 1
            c2 = transcript.count(term)
            if c2:
                score += min(c2, 5) * 1.5 * weight; hits += 1
            if hits:
                matched.append(term)
                if not snippet:
                    source = n.get("summary") or n.get("transcription") or ""
                    m = re.search(re.escape(term), source, re.IGNORECASE)
                    if m:
                        s = max(0, m.start() - 70)
                        snippet = ("…" if s else "") + source[s:m.end() + 130].replace("\n", " ") + "…"
        if score > 0:
            n.pop("transcription", None)
            results.append({**n, "score": round(score, 2),
                            "matched_terms": matched[:5], "snippet": snippet})
    results.sort(key=lambda x: -x["score"])
    return {"query": q, "expanded_terms": terms, "items": results[: body.limit],
            "total": len(results)}


# ------------------------------------------------------------------ workspace chat
@router.post("/chat")
async def chat_workspace(body: ChatRequest, user: dict = Depends(get_current_user)):
    """Ask a question across several notes at once."""
    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message vide")
    query: dict = {"user_id": user["user_id"], "archived": {"$ne": True}, "status": "ready"}
    if body.note_ids:
        query["id"] = {"$in": body.note_ids[:12]}
    notes = await db.notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(12)
    if not notes:
        raise HTTPException(status_code=422, detail="Aucune note exploitable pour répondre")
    contexts = [{"id": n["id"], "title": n.get("title") or "Note",
                 "content": await note_context(n, 12000)} for n in notes]
    history = await db.note_chats.find(
        {"user_id": user["user_id"], "note_id": "__workspace__"}, {"_id": 0, "role": 1, "content": 1}
    ).sort("created_at", 1).to_list(20)
    await db.note_chats.insert_one({"id": new_id(), "user_id": user["user_id"],
                                    "note_id": "__workspace__", "role": "user",
                                    "content": question, "created_at": now_utc()})
    try:
        answer = await ai.ask_notes(question, contexts, history, pref(user, "language", "fr"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Assistant indisponible : {e}")
    msg = {"id": new_id(), "user_id": user["user_id"], "note_id": "__workspace__",
           "role": "assistant", "content": answer,
           "citations": [n["id"] for n in notes], "created_at": now_utc()}
    await db.note_chats.insert_one(dict(msg))
    msg.pop("_id", None)
    return {"message": msg, "sources": [{"id": n["id"], "title": n.get("title")} for n in notes]}


@router.get("/chat/workspace")
async def workspace_history(user: dict = Depends(get_current_user)):
    return await db.note_chats.find(
        {"user_id": user["user_id"], "note_id": "__workspace__"}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)


@router.delete("/chat/workspace")
async def clear_workspace_history(user: dict = Depends(get_current_user)):
    await db.note_chats.delete_many({"user_id": user["user_id"], "note_id": "__workspace__"})
    return {"ok": True}
