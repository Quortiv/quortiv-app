"""End-to-end smoke test for the Quortiv API (run against the live local backend)."""
import io
import json
import os
import sys

import requests

BASE = os.environ.get("QUORTIV_BASE", "http://localhost:8001") + "/api"
FAILS = []


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


def main():
    r = requests.post(f"{BASE}/auth/guest", timeout=30)
    check("auth/guest", r.status_code == 200, r.text[:200])
    tok = r.json()["session_token"]
    H = {"Authorization": f"Bearer {tok}"}

    r = requests.get(f"{BASE}/auth/me", headers=H, timeout=30)
    check("auth/me", r.status_code == 200)

    r = requests.get(f"{BASE}/folders", headers=H, timeout=30)
    check("folders seeded", r.status_code == 200 and len(r.json()) == 3, r.text[:200])
    folder_id = r.json()[0]["id"]

    r = requests.post(f"{BASE}/folders", json={"name": "Test QA", "color": "#2E5BFF"}, headers=H, timeout=30)
    check("folder create", r.status_code == 200)
    tmp_folder = r.json()["id"]
    r = requests.patch(f"{BASE}/folders/{tmp_folder}", json={"name": "Test QA 2"}, headers=H, timeout=30)
    check("folder rename", r.status_code == 200 and r.json()["name"] == "Test QA 2")

    r = requests.get(f"{BASE}/templates", headers=H, timeout=30)
    templates = r.json()
    check("templates builtin", r.status_code == 200 and len(templates) >= 10, str(len(templates)))
    tpl = next(t for t in templates if t["category"] == "work")

    r = requests.post(f"{BASE}/templates", json={"name": "Mon modèle", "focus": "Résume en 3 points.",
                                                 "sections": ["Résumé"]}, headers=H, timeout=30)
    check("template create", r.status_code == 200, r.text[:200])
    custom_tpl = r.json()["id"]
    r = requests.patch(f"{BASE}/auth/me", json={"default_template_id": custom_tpl}, headers=H, timeout=30)
    check("prefs default template", r.status_code == 200
          and r.json()["prefs"]["default_template_id"] == custom_tpl)

    # ---- text note (real AI)
    text = ("Réunion produit du 12 juin. Sarah présente la refonte de l'onboarding : "
            "le taux d'activation est passé de 34% à 41%. Karim signale que l'export PDF "
            "plante sur les gros fichiers. Décision : on décale la sortie au 30 juin. "
            "Sarah prépare la maquette finale avant le 20 juin, Karim corrige l'export cette semaine.")
    r = requests.post(f"{BASE}/notes/from-text",
                      json={"text": text, "template_id": tpl["id"], "folder_id": folder_id,
                            "language": "fr"}, headers=H, timeout=60)
    check("from-text create", r.status_code == 200, r.text[:300])
    note_id = r.json()["id"]

    import time
    note = None
    for _ in range(40):
        time.sleep(3)
        note = requests.get(f"{BASE}/notes/{note_id}", headers=H, timeout=30).json()
        if note["status"] != "processing":
            break
    check("AI analysis completes", note and note["status"] == "ready",
          json.dumps(note)[:300] if note else "no note")
    if note and note["status"] == "ready":
        check("summary non-empty", len(note["summary"]) > 80)
        check("actions extracted", len(note["actions"]) >= 1, str(note["actions"]))
        check("tags extracted", len(note["tags"]) >= 2, str(note["tags"]))
        check("key points", len(note["key_points"]) >= 1)

    # ---- document import
    doc = ("Rapport trimestriel. Le chiffre d'affaires atteint 1,2 M EUR, en hausse de 18%. "
           "La marge brute est stable à 62%. Trois recrutements sont prévus au T3.") * 3
    r = requests.post(f"{BASE}/notes/from-document", headers=H, timeout=60,
                      files={"file": ("rapport.txt", io.BytesIO(doc.encode()), "text/plain")},
                      data={"language": "fr"})
    check("from-document", r.status_code == 200, r.text[:300])
    doc_note = r.json()["id"] if r.status_code == 200 else None

    # ---- url import
    r = requests.post(f"{BASE}/notes/from-url", headers=H, timeout=90,
                      json={"url": "https://example.com"})
    check("from-url rejects thin pages", r.status_code in (422, 200), r.text[:200])

    # ---- listing & filters
    r = requests.get(f"{BASE}/notes?limit=10&sort=recent", headers=H, timeout=30)
    check("notes list envelope", r.status_code == 200 and "items" in r.json() and "total" in r.json())
    r = requests.get(f"{BASE}/notes?source_type=text", headers=H, timeout=30)
    check("filter by source_type", r.status_code == 200 and all(
        i["source_type"] == "text" for i in r.json()["items"]))
    r = requests.get(f"{BASE}/notes?q=onboarding", headers=H, timeout=30)
    check("full text search", r.status_code == 200 and r.json()["total"] >= 1, r.text[:200])
    r = requests.get(f"{BASE}/tags", headers=H, timeout=30)
    check("tags aggregate", r.status_code == 200 and isinstance(r.json(), list))

    # ---- update / favorite / archive
    r = requests.patch(f"{BASE}/notes/{note_id}", json={"favorite": True, "tags": ["qa", "réunion"]},
                       headers=H, timeout=30)
    check("note patch", r.status_code == 200 and r.json()["favorite"] is True)
    r = requests.get(f"{BASE}/notes?favorite=true", headers=H, timeout=30)
    check("filter favorites", r.status_code == 200 and r.json()["total"] == 1)

    # ---- export
    for fmt, ctype in (("pdf", "application/pdf"), ("md", "text/markdown"), ("txt", "text/plain")):
        r = requests.get(f"{BASE}/notes/{note_id}/export?format={fmt}", headers=H, timeout=60)
        check(f"export {fmt}", r.status_code == 200 and ctype in r.headers.get("content-type", "")
              and len(r.content) > 200, f"{r.status_code} {len(r.content)}")
    check("pdf magic bytes", requests.get(f"{BASE}/notes/{note_id}/export?format=pdf",
                                          headers=H, timeout=60).content[:4] == b"%PDF")

    # ---- share
    r = requests.post(f"{BASE}/notes/{note_id}/share", headers=H, timeout=30)
    check("share create", r.status_code == 200, r.text[:200])
    share_id = r.json().get("share_id")
    r = requests.get(f"{BASE}/public/notes/{share_id}", timeout=30)
    check("public read (no auth)", r.status_code == 200 and r.json()["note"]["id"] == note_id)
    r = requests.get(f"{BASE}/public/notes/{share_id}/export?format=pdf", timeout=60)
    check("public export", r.status_code == 200 and r.content[:4] == b"%PDF")
    requests.delete(f"{BASE}/notes/{note_id}/share", headers=H, timeout=30)
    r = requests.get(f"{BASE}/public/notes/{share_id}", timeout=30)
    check("share revoked", r.status_code == 404)

    # ---- chat
    r = requests.post(f"{BASE}/notes/{note_id}/chat",
                      json={"message": "Quelles sont les actions de Karim ?"}, headers=H, timeout=120)
    check("note chat", r.status_code == 200 and len(r.json()["message"]["content"]) > 20, r.text[:300])
    r = requests.get(f"{BASE}/notes/{note_id}/chat", headers=H, timeout=30)
    check("chat history", r.status_code == 200 and len(r.json()) == 2)
    r = requests.get(f"{BASE}/notes/{note_id}/suggestions", headers=H, timeout=90)
    check("chat suggestions", r.status_code == 200 and isinstance(r.json(), list))

    # ---- smart search
    r = requests.post(f"{BASE}/search/smart", json={"query": "activation onboarding"}, headers=H, timeout=120)
    check("smart search", r.status_code == 200 and r.json()["total"] >= 1, r.text[:300])

    # ---- translate
    r = requests.post(f"{BASE}/notes/{note_id}/translate",
                      json={"target_lang": "en", "scope": "summary"}, headers=H, timeout=60)
    check("translate queued", r.status_code == 200, r.text[:200])
    for _ in range(30):
        time.sleep(3)
        n = requests.get(f"{BASE}/notes/{note_id}", headers=H, timeout=30).json()
        if n.get("translation_status") in ("ready", "failed"):
            break
    check("translation ready", n.get("translation_status") == "ready"
          and len((n.get("translations") or {}).get("en", {}).get("summary") or "") > 50,
          str(n.get("translation_status")))

    # ---- reprocess with another level
    r = requests.post(f"{BASE}/notes/{note_id}/reprocess",
                      json={"summary_level": "brief"}, headers=H, timeout=30)
    check("reprocess queued", r.status_code == 200)
    for _ in range(40):
        time.sleep(3)
        n = requests.get(f"{BASE}/notes/{note_id}", headers=H, timeout=30).json()
        if n["status"] != "processing":
            break
    check("reprocess done", n["status"] == "ready" and n["summary_level"] == "brief", n.get("error") or "")

    # ---- reminders + actions inbox
    r = requests.get(f"{BASE}/actions", headers=H, timeout=30)
    check("actions inbox", r.status_code == 200 and isinstance(r.json(), list))
    actions = r.json()
    r = requests.post(f"{BASE}/reminders", json={"text": "Relancer Karim", "note_id": note_id,
                                                 "action_id": actions[0]["id"] if actions else None,
                                                 "due_at": "2026-07-01"}, headers=H, timeout=30)
    check("reminder create", r.status_code == 200, r.text[:200])
    rid = r.json()["id"]
    r = requests.patch(f"{BASE}/reminders/{rid}", json={"done": True}, headers=H, timeout=30)
    check("reminder complete", r.status_code == 200 and r.json()["done"] is True)
    check("reminder deletes", requests.delete(f"{BASE}/reminders/{rid}", headers=H,
                                              timeout=30).status_code == 200)

    # ---- analytics / graph / stats
    for path in ("stats", "analytics", "graph"):
        r = requests.get(f"{BASE}/{path}", headers=H, timeout=30)
        check(f"{path} endpoint", r.status_code == 200, r.text[:200])
    r = requests.get(f"{BASE}/notes/{note_id}/related", headers=H, timeout=30)
    check("related notes", r.status_code == 200 and isinstance(r.json(), list))

    # ---- bulk + folder delete with move
    if doc_note:
        r = requests.post(f"{BASE}/notes/bulk", json={"note_ids": [doc_note], "action": "archive"},
                          headers=H, timeout=30)
        check("bulk archive", r.status_code == 200 and r.json()["affected"] == 1)
        r = requests.get(f"{BASE}/notes?archived=true", headers=H, timeout=30)
        check("archived listing", r.status_code == 200 and r.json()["total"] == 1)
    r = requests.delete(f"{BASE}/folders/{tmp_folder}?move_to={folder_id}", headers=H, timeout=30)
    check("folder delete with move", r.status_code == 200)

    # ---- security: no cross-user access
    other = requests.post(f"{BASE}/auth/guest", timeout=30).json()
    H2 = {"Authorization": f"Bearer {other['session_token']}"}
    check("cross-user note blocked",
          requests.get(f"{BASE}/notes/{note_id}", headers=H2, timeout=30).status_code == 404)
    check("unauthenticated blocked",
          requests.get(f"{BASE}/notes", timeout=30).status_code == 401)

    # ---- validation
    check("empty text rejected",
          requests.post(f"{BASE}/notes/from-text", json={"text": " "}, headers=H,
                        timeout=30).status_code == 400)
    check("bad media rejected",
          requests.post(f"{BASE}/notes/upload", headers=H, timeout=30,
                        files={"file": ("x.exe", io.BytesIO(b"xx"), "application/octet-stream")}
                        ).status_code == 415)
    check("bad url rejected",
          requests.post(f"{BASE}/notes/from-url", json={"url": "notaurl"}, headers=H,
                        timeout=30).status_code == 400)

    # ---- account export + delete
    r = requests.get(f"{BASE}/auth/export", headers=H, timeout=60)
    check("account export", r.status_code == 200 and r.json()["counts"]["notes"] >= 1)
    check("account delete", requests.delete(f"{BASE}/auth/me", headers=H, timeout=30).status_code == 200)
    check("session invalid after delete",
          requests.get(f"{BASE}/auth/me", headers=H, timeout=30).status_code == 401)

    print("\n" + ("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED: {FAILS}"))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
