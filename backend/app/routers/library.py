from fastapi import APIRouter, Depends, HTTPException

from ..core import db
from ..deps import get_current_user
from ..models import (Folder, FolderCreate, FolderUpdate, Template,
                      TemplateCreate, TemplateUpdate, now_utc)

router = APIRouter(tags=["library"])


# ------------------------------------------------------------------ folders
@router.get("/folders")
async def list_folders(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    folders = await db.folders.find({"user_id": uid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for f in folders:
        f["note_count"] = await db.notes.count_documents(
            {"user_id": uid, "folder_id": f["id"], "archived": {"$ne": True}})
    return folders


@router.post("/folders")
async def create_folder(body: FolderCreate, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom du dossier est requis")
    if await db.folders.find_one({"user_id": user["user_id"], "name": name}):
        raise HTTPException(status_code=409, detail="Un dossier porte déjà ce nom")
    folder = Folder(user_id=user["user_id"], name=name[:60],
                    color=body.color or "#2E5BFF", icon=body.icon or "folder-outline")
    await db.folders.insert_one(folder.dict())
    return {**folder.dict(), "note_count": 0}


@router.patch("/folders/{folder_id}")
async def update_folder(folder_id: str, body: FolderUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.dict(exclude_none=True).items()}
    if "name" in update:
        update["name"] = update["name"].strip()[:60]
        if not update["name"]:
            raise HTTPException(status_code=400, detail="Le nom du dossier est requis")
    res = await db.folders.update_one({"id": folder_id, "user_id": user["user_id"]}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    folder = await db.folders.find_one({"id": folder_id}, {"_id": 0})
    folder["note_count"] = await db.notes.count_documents(
        {"user_id": user["user_id"], "folder_id": folder_id})
    return folder


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, move_to: str | None = None,
                        user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    if not await db.folders.find_one({"id": folder_id, "user_id": uid}):
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    target = None
    if move_to:
        if not await db.folders.find_one({"id": move_to, "user_id": uid}):
            raise HTTPException(status_code=404, detail="Dossier de destination introuvable")
        target = move_to
    moved = await db.notes.update_many({"user_id": uid, "folder_id": folder_id},
                                       {"$set": {"folder_id": target, "updated_at": now_utc()}})
    await db.folders.delete_one({"id": folder_id, "user_id": uid})
    return {"ok": True, "notes_moved": moved.modified_count, "moved_to": target}


# ------------------------------------------------------------------ templates
@router.get("/templates")
async def list_templates(user: dict = Depends(get_current_user)):
    templates = await db.templates.find(
        {"$or": [{"user_id": None}, {"user_id": user["user_id"]}]}, {"_id": 0}
    ).sort("sort_order", 1).to_list(500)
    default_id = (user.get("prefs") or {}).get("default_template_id")
    for t in templates:
        t["is_default"] = t["id"] == default_id
    return templates


@router.post("/templates")
async def create_template(body: TemplateCreate, user: dict = Depends(get_current_user)):
    if not body.name.strip() or not body.focus.strip():
        raise HTTPException(status_code=400, detail="Nom et instructions requis")
    tpl = Template(
        user_id=user["user_id"], name=body.name.strip()[:60],
        description=body.description.strip()[:140], icon=body.icon or "sparkles-outline",
        category=body.category or "custom", focus=body.focus.strip(),
        sections=[s.strip() for s in body.sections if s.strip()][:10],
        sort_order=300,
    )
    await db.templates.insert_one(tpl.dict())
    return tpl.dict()


@router.patch("/templates/{template_id}")
async def update_template(template_id: str, body: TemplateUpdate,
                          user: dict = Depends(get_current_user)):
    existing = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Modèle introuvable")
    if existing.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Les modèles intégrés ne sont pas modifiables. Dupliquez-le d'abord.")
    await db.templates.update_one({"id": template_id}, {"$set": body.dict(exclude_none=True)})
    return await db.templates.find_one({"id": template_id}, {"_id": 0})


@router.post("/templates/{template_id}/duplicate")
async def duplicate_template(template_id: str, user: dict = Depends(get_current_user)):
    src = await db.templates.find_one(
        {"id": template_id, "$or": [{"user_id": None}, {"user_id": user["user_id"]}]}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Modèle introuvable")
    tpl = Template(
        user_id=user["user_id"], name=f"{src['name']} (copie)"[:60],
        description=src.get("description", ""), icon=src.get("icon", "sparkles-outline"),
        category="custom", focus=src.get("focus", ""), sections=src.get("sections", []),
        sort_order=300,
    )
    await db.templates.insert_one(tpl.dict())
    return tpl.dict()


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    res = await db.templates.delete_one({"id": template_id, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=403, detail="Seuls vos modèles personnalisés peuvent être supprimés")
    if (user.get("prefs") or {}).get("default_template_id") == template_id:
        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"prefs.default_template_id": None}})
    return {"ok": True}
