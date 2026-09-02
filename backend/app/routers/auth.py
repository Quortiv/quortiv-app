import uuid
from datetime import timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from ..core import APP_SLUG, db, logger
from ..deps import get_current_user
from ..models import PrefsUpdate, SessionRequest, User, UserPrefs, now_utc
from ..notes_service import seed_user_defaults

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_DAYS = 30


async def _issue_session(user_id: str, token: Optional[str] = None) -> str:
    session_token = token or f"qv_{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=SESSION_DAYS),
    })
    return session_token


@router.post("/session")
async def auth_session(body: SessionRequest):
    try:
        async with httpx.AsyncClient(timeout=30) as hx:
            r = await hx.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
    except Exception:  # noqa: BLE001
        logger.exception("oauth session-data unreachable")
        raise HTTPException(status_code=503, detail="Service d'authentification injoignable")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    data = r.json()

    email, name = data.get("email"), data.get("name")
    picture, session_token = data.get("picture"), data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Données utilisateur incomplètes")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
                                  {"$set": {"name": name, "picture": picture, "is_guest": False}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(User(user_id=user_id, email=email, name=name, picture=picture).dict())
    await seed_user_defaults(user_id)
    await _issue_session(user_id, session_token)
    return {"session_token": session_token, "user": await db.users.find_one({"user_id": user_id}, {"_id": 0})}


@router.post("/guest")
async def auth_guest():
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    email = f"invite_{uuid.uuid4().hex[:8]}@{APP_SLUG}.local"
    await db.users.insert_one(
        User(user_id=user_id, email=email, name="Invité", is_guest=True).dict())
    await seed_user_defaults(user_id)
    token = await _issue_session(user_id)
    return {"session_token": token, "user": await db.users.find_one({"user_id": user_id}, {"_id": 0})}


@router.get("/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@router.patch("/me")
async def update_prefs(body: PrefsUpdate, user: dict = Depends(get_current_user)):
    payload = body.dict(exclude_none=True)
    name = payload.pop("name", None)
    update = {f"prefs.{k}": v for k, v in payload.items()}
    if name is not None:
        update["name"] = name.strip()[:80]
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})


@router.post("/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        await db.user_sessions.delete_one(
            {"session_token": authorization.replace("Bearer ", "", 1).strip()})
    return {"ok": True}


@router.get("/export")
async def export_account(user: dict = Depends(get_current_user)):
    """Full user data export (GDPR-style portability)."""
    uid = user["user_id"]
    notes = await db.notes.find({"user_id": uid}, {"_id": 0}).to_list(5000)
    folders = await db.folders.find({"user_id": uid}, {"_id": 0}).to_list(500)
    templates = await db.templates.find({"user_id": uid}, {"_id": 0}).to_list(500)
    reminders = await db.reminders.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    chats = await db.note_chats.find({"user_id": uid}, {"_id": 0}).to_list(5000)
    return {
        "exported_at": now_utc().isoformat(),
        "account": {k: user.get(k) for k in ("user_id", "email", "name", "is_guest", "prefs", "created_at")},
        "counts": {"notes": len(notes), "folders": len(folders), "templates": len(templates),
                   "reminders": len(reminders), "messages": len(chats)},
        "notes": notes, "folders": folders, "templates": templates,
        "reminders": reminders, "conversations": chats,
    }


@router.delete("/me")
async def delete_account(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    for coll in (db.notes, db.folders, db.reminders, db.note_chats, db.user_sessions):
        await coll.delete_many({"user_id": uid})
    await db.templates.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    logger.info(f"account deleted: {uid}")
    return {"ok": True, "deleted": uid}
