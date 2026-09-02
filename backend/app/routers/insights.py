from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from ..core import db
from ..deps import get_current_user
from ..models import Reminder, ReminderCreate, ReminderUpdate, now_utc

router = APIRouter(tags=["insights"])


@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    total = await db.notes.count_documents({"user_id": uid, "archived": {"$ne": True}})
    folders = await db.folders.count_documents({"user_id": uid})
    week_start = now_utc() - timedelta(days=7)
    this_week = await db.notes.count_documents({"user_id": uid, "created_at": {"$gte": week_start}})
    processing = await db.notes.count_documents({"user_id": uid, "status": "processing"})
    agg = await db.notes.aggregate([
        {"$match": {"user_id": uid}},
        {"$group": {"_id": None, "duration": {"$sum": "$duration_sec"},
                    "words": {"$sum": "$word_count"}}},
    ]).to_list(1)
    open_actions = 0
    async for n in db.notes.find({"user_id": uid}, {"_id": 0, "actions": 1}):
        open_actions += sum(1 for a in (n.get("actions") or []) if not a.get("done"))
    return {
        "total_notes": total, "total_folders": folders, "notes_this_week": this_week,
        "processing": processing, "open_actions": open_actions,
        "total_duration_sec": (agg[0]["duration"] if agg else 0) or 0,
        "total_words": (agg[0]["words"] if agg else 0) or 0,
    }


@router.get("/analytics")
async def analytics(days: int = 30, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    days = max(7, min(days, 90))
    since = now_utc() - timedelta(days=days)
    notes = await db.notes.find(
        {"user_id": uid},
        {"_id": 0, "created_at": 1, "source_type": 1, "template_name": 1, "duration_sec": 1,
         "tags": 1, "actions": 1, "status": 1, "word_count": 1, "language": 1},
    ).to_list(5000)

    by_day: Counter = Counter()
    by_source: Counter = Counter()
    by_template: Counter = Counter()
    by_lang: Counter = Counter()
    tag_counter: Counter = Counter()
    duration_recent = 0
    words_recent = 0
    actions_total = actions_done = 0
    recent_count = 0

    for n in notes:
        created = n.get("created_at")
        actions = n.get("actions") or []
        actions_total += len(actions)
        actions_done += sum(1 for a in actions if a.get("done"))
        if created and created.replace(tzinfo=created.tzinfo or now_utc().tzinfo) >= since:
            recent_count += 1
            by_day[created.strftime("%Y-%m-%d")] += 1
            by_source[n.get("source_type") or "autre"] += 1
            by_template[n.get("template_name") or "—"] += 1
            by_lang[n.get("language") or "fr"] += 1
            duration_recent += n.get("duration_sec") or 0
            words_recent += n.get("word_count") or 0
            for t in n.get("tags") or []:
                tag_counter[t] += 1

    series = []
    for i in range(days - 1, -1, -1):
        day = (now_utc() - timedelta(days=i)).strftime("%Y-%m-%d")
        series.append({"date": day, "count": by_day.get(day, 0)})

    busiest = max(series, key=lambda d: d["count"]) if series else {"date": None, "count": 0}
    return {
        "range_days": days,
        "notes_in_range": recent_count,
        "series": series,
        "by_source": [{"key": k, "count": v} for k, v in by_source.most_common()],
        "by_template": [{"key": k, "count": v} for k, v in by_template.most_common(8)],
        "by_language": [{"key": k, "count": v} for k, v in by_lang.most_common()],
        "top_tags": [{"tag": k, "count": v} for k, v in tag_counter.most_common(12)],
        "duration_sec": duration_recent,
        "words": words_recent,
        "actions": {"total": actions_total, "done": actions_done,
                    "open": actions_total - actions_done,
                    "completion": round(actions_done / actions_total * 100) if actions_total else 0},
        "busiest_day": busiest,
        "avg_per_week": round(recent_count / (days / 7), 1) if days else 0,
    }


@router.get("/graph")
async def knowledge_graph(user: dict = Depends(get_current_user)):
    """Nodes = notes and tags; edges = tag membership. Powers the knowledge map."""
    uid = user["user_id"]
    notes = await db.notes.find(
        {"user_id": uid, "archived": {"$ne": True}},
        {"_id": 0, "id": 1, "title": 1, "tags": 1, "source_type": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(200)
    tag_counter: Counter = Counter()
    for n in notes:
        for t in n.get("tags") or []:
            tag_counter[t] += 1
    active_tags = {t for t, c in tag_counter.items() if c >= 2}
    nodes = [{"id": f"n:{n['id']}", "type": "note", "label": n.get("title") or "Note",
              "note_id": n["id"], "source_type": n.get("source_type"),
              "weight": len(set(n.get("tags") or []) & active_tags)}
             for n in notes if set(n.get("tags") or []) & active_tags]
    nodes += [{"id": f"t:{t}", "type": "tag", "label": t, "weight": c}
              for t, c in tag_counter.items() if c >= 2]
    edges = []
    for n in notes:
        for t in set(n.get("tags") or []) & active_tags:
            edges.append({"source": f"n:{n['id']}", "target": f"t:{t}"})
    return {"nodes": nodes, "edges": edges,
            "orphans": sum(1 for n in notes if not (set(n.get("tags") or []) & active_tags))}


# ------------------------------------------------------------------ reminders
@router.get("/reminders")
async def list_reminders(include_done: bool = False, user: dict = Depends(get_current_user)):
    query: dict = {"user_id": user["user_id"]}
    if not include_done:
        query["done"] = False
    return await db.reminders.find(query, {"_id": 0}).sort("due_at", 1).to_list(500)


@router.post("/reminders")
async def create_reminder(body: ReminderCreate, user: dict = Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Intitulé requis")
    note_title = None
    if body.note_id:
        note = await db.notes.find_one({"id": body.note_id, "user_id": user["user_id"]},
                                       {"_id": 0, "title": 1})
        if not note:
            raise HTTPException(status_code=404, detail="Note introuvable")
        note_title = note.get("title")
    reminder = Reminder(user_id=user["user_id"], note_id=body.note_id, note_title=note_title,
                        action_id=body.action_id, text=body.text.strip()[:200], due_at=body.due_at)
    await db.reminders.insert_one(reminder.dict())
    return reminder.dict()


@router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, body: ReminderUpdate,
                          user: dict = Depends(get_current_user)):
    update = body.dict(exclude_none=True)
    if not update:
        raise HTTPException(status_code=400, detail="Aucune modification fournie")
    res = await db.reminders.update_one({"id": reminder_id, "user_id": user["user_id"]},
                                        {"$set": update})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Rappel introuvable")
    reminder = await db.reminders.find_one({"id": reminder_id}, {"_id": 0})
    if reminder.get("action_id") and reminder.get("note_id") and "done" in update:
        await db.notes.update_one(
            {"id": reminder["note_id"], "user_id": user["user_id"],
             "actions.id": reminder["action_id"]},
            {"$set": {"actions.$.done": update["done"], "updated_at": now_utc()}})
    return reminder


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    res = await db.reminders.delete_one({"id": reminder_id, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Rappel introuvable")
    return {"ok": True}


@router.get("/actions")
async def list_actions(open_only: bool = True, user: dict = Depends(get_current_user)):
    """Flattened action inbox across every note."""
    notes = await db.notes.find(
        {"user_id": user["user_id"], "archived": {"$ne": True}, "actions": {"$ne": []}},
        {"_id": 0, "id": 1, "title": 1, "actions": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(500)
    items = []
    for n in notes:
        for a in n.get("actions") or []:
            if open_only and a.get("done"):
                continue
            items.append({**a, "note_id": n["id"], "note_title": n.get("title"),
                          "note_created_at": n.get("created_at")})
    items.sort(key=lambda x: (x.get("due_date") or "9999-12-31"))
    return items
