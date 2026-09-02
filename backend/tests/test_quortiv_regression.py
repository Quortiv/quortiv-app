"""Focused regression pytest suite for Quortiv.
Runs against the public preview URL and complements test_api_e2e.py by exercising
edge cases, error handling and validations mentioned in the review request.
"""
import io
import time
import pytest
import requests


# --- Auth ---
class TestAuth:
    def test_auth_me_unauthenticated_401(self, api):
        r = requests.get(f"{api}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_auth_me_bad_token_401(self, api):
        r = requests.get(f"{api}/auth/me", headers={"Authorization": "Bearer garbage"}, timeout=30)
        assert r.status_code == 401

    def test_auth_me_ok(self, api, H):
        r = requests.get(f"{api}/auth/me", headers=H, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "user" in data or "id" in data or "email" in data or "prefs" in data

    def test_patch_prefs_language(self, api, H):
        r = requests.patch(f"{api}/auth/me", json={"language": "en"}, headers=H, timeout=30)
        assert r.status_code == 200
        prefs = r.json().get("prefs") or {}
        assert prefs.get("language") == "en"
        # revert
        requests.patch(f"{api}/auth/me", json={"language": "fr"}, headers=H, timeout=30)

    def test_logout(self, api):
        # Fresh token to avoid killing shared fixture
        t = requests.post(f"{api}/auth/guest", timeout=30).json()["session_token"]
        h = {"Authorization": f"Bearer {t}"}
        r = requests.post(f"{api}/auth/logout", headers=h, timeout=30)
        assert r.status_code == 200
        # After logout, /auth/me should be 401
        r2 = requests.get(f"{api}/auth/me", headers=h, timeout=30)
        assert r2.status_code == 401


# --- Folders ---
class TestFolders:
    def test_folders_seeded(self, api, H):
        r = requests.get(f"{api}/folders", headers=H, timeout=30)
        assert r.status_code == 200
        folders = r.json()
        assert isinstance(folders, list)
        assert len(folders) >= 1

    def test_folder_delete_with_move(self, api, H):
        f1 = requests.post(f"{api}/folders", json={"name": "TEST_A"}, headers=H, timeout=30).json()
        f2 = requests.post(f"{api}/folders", json={"name": "TEST_B"}, headers=H, timeout=30).json()
        # Delete f1 moving notes (none) to f2
        r = requests.delete(f"{api}/folders/{f1['id']}?move_to={f2['id']}", headers=H, timeout=30)
        assert r.status_code == 200
        # Cleanup
        requests.delete(f"{api}/folders/{f2['id']}", headers=H, timeout=30)


# --- Templates ---
class TestTemplates:
    def test_templates_count_min_10(self, api, H):
        r = requests.get(f"{api}/templates", headers=H, timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_builtin_template_cannot_be_patched(self, api, H):
        templates = requests.get(f"{api}/templates", headers=H, timeout=30).json()
        builtin = next((t for t in templates if t.get("is_builtin")), None)
        assert builtin, "no builtin template found"
        r = requests.patch(f"{api}/templates/{builtin['id']}", json={"name": "hack"}, headers=H, timeout=30)
        assert r.status_code == 403

    def test_builtin_template_cannot_be_deleted(self, api, H):
        templates = requests.get(f"{api}/templates", headers=H, timeout=30).json()
        builtin = next((t for t in templates if t.get("is_builtin")), None)
        assert builtin
        r = requests.delete(f"{api}/templates/{builtin['id']}", headers=H, timeout=30)
        assert r.status_code == 403

    def test_builtin_template_duplicate(self, api, H):
        templates = requests.get(f"{api}/templates", headers=H, timeout=30).json()
        builtin = next((t for t in templates if t.get("is_builtin")), None)
        r = requests.post(f"{api}/templates/{builtin['id']}/duplicate", headers=H, timeout=30)
        assert r.status_code == 200
        dup = r.json()
        assert not dup.get("is_builtin")
        # Cleanup
        requests.delete(f"{api}/templates/{dup['id']}", headers=H, timeout=30)


# --- Capture / validation ---
class TestCaptureValidation:
    def test_from_text_empty_400(self, api, H):
        r = requests.post(f"{api}/notes/from-text", json={"text": " "}, headers=H, timeout=30)
        assert r.status_code == 400

    def test_from_url_invalid_400(self, api, H):
        r = requests.post(f"{api}/notes/from-url", json={"url": "notaurl"}, headers=H, timeout=30)
        assert r.status_code == 400

    def test_upload_bad_extension_415(self, api, H):
        r = requests.post(
            f"{api}/notes/upload",
            headers=H,
            files={"file": ("x.exe", io.BytesIO(b"xx"), "application/octet-stream")},
            timeout=30,
        )
        assert r.status_code == 415

    def test_from_document_bad_extension_415(self, api, H):
        r = requests.post(
            f"{api}/notes/from-document",
            headers=H,
            files={"file": ("x.exe", io.BytesIO(b"xx"), "application/octet-stream")},
            data={"language": "fr"},
            timeout=30,
        )
        assert r.status_code in (400, 415, 422)

    def test_from_document_pdf(self, api, H):
        # minimal valid PDF-ish bytes; the extract module may still reject
        pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        r = requests.post(
            f"{api}/notes/from-document",
            headers=H,
            files={"file": ("empty.pdf", io.BytesIO(pdf), "application/pdf")},
            data={"language": "fr"},
            timeout=60,
        )
        # thin pdf may be rejected with 422 (no text extractable)
        assert r.status_code in (200, 400, 422)


# --- Notes lifecycle (single AI note) ---
@pytest.fixture(scope="module")
def ready_note(api):
    tok = requests.post(f"{api}/auth/guest", timeout=30).json()["session_token"]
    h = {"Authorization": f"Bearer {tok}"}
    tpl = next(t for t in requests.get(f"{api}/templates", headers=h, timeout=30).json()
               if t["category"] == "work")
    text = ("Réunion produit 12 juin. Sarah présente la refonte de l'onboarding, activation "
            "34% -> 41%. Karim signale export PDF planté. Décision: décaler au 30 juin. "
            "Sarah prépare la maquette avant 20 juin. Karim corrige l'export cette semaine.")
    r = requests.post(f"{api}/notes/from-text",
                      json={"text": text, "template_id": tpl["id"], "language": "fr"},
                      headers=h, timeout=60)
    assert r.status_code == 200, r.text
    nid = r.json()["id"]
    note = None
    for _ in range(45):
        time.sleep(3)
        note = requests.get(f"{api}/notes/{nid}", headers=h, timeout=30).json()
        if note.get("status") != "processing":
            break
    assert note and note["status"] == "ready", str(note)[:400]
    return {"h": h, "id": nid, "note": note}


class TestNotesLifecycle:
    def test_notes_list_envelope(self, api, ready_note):
        r = requests.get(f"{api}/notes?limit=10&sort=recent", headers=ready_note["h"], timeout=30)
        data = r.json()
        assert r.status_code == 200
        assert "items" in data and "total" in data

    def test_notes_filter_source_type(self, api, ready_note):
        r = requests.get(f"{api}/notes?source_type=text", headers=ready_note["h"], timeout=30)
        assert r.status_code == 200
        assert all(i["source_type"] == "text" for i in r.json()["items"])

    def test_notes_search(self, api, ready_note):
        r = requests.get(f"{api}/notes?q=onboarding", headers=ready_note["h"], timeout=30)
        assert r.status_code == 200 and r.json()["total"] >= 1

    def test_note_export_pdf_magic(self, api, ready_note):
        r = requests.get(f"{api}/notes/{ready_note['id']}/export?format=pdf",
                         headers=ready_note["h"], timeout=60)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_note_export_md_and_txt(self, api, ready_note):
        for fmt, ctype in (("md", "text/markdown"), ("txt", "text/plain")):
            r = requests.get(f"{api}/notes/{ready_note['id']}/export?format={fmt}",
                             headers=ready_note["h"], timeout=60)
            assert r.status_code == 200
            assert ctype in r.headers.get("content-type", "")
            assert len(r.content) > 100

    def test_note_plain(self, api, ready_note):
        r = requests.get(f"{api}/notes/{ready_note['id']}/plain",
                         headers=ready_note["h"], timeout=30)
        assert r.status_code == 200

    def test_share_public_lifecycle(self, api, ready_note):
        h = ready_note["h"]
        nid = ready_note["id"]
        r = requests.post(f"{api}/notes/{nid}/share", headers=h, timeout=30)
        assert r.status_code == 200
        share_id = r.json()["share_id"]
        # public read w/o auth
        r2 = requests.get(f"{api}/public/notes/{share_id}", timeout=30)
        assert r2.status_code == 200 and r2.json()["note"]["id"] == nid
        # public export
        r3 = requests.get(f"{api}/public/notes/{share_id}/export?format=pdf", timeout=60)
        assert r3.status_code == 200 and r3.content[:4] == b"%PDF"
        # revoke
        rd = requests.delete(f"{api}/notes/{nid}/share", headers=h, timeout=30)
        assert rd.status_code == 200
        r4 = requests.get(f"{api}/public/notes/{share_id}", timeout=30)
        assert r4.status_code == 404

    def test_chat_and_history(self, api, ready_note):
        h = ready_note["h"]
        r = requests.post(f"{api}/notes/{ready_note['id']}/chat",
                          json={"message": "Quelles décisions ?"}, headers=h, timeout=120)
        assert r.status_code == 200
        assert len(r.json()["message"]["content"]) > 10
        r2 = requests.get(f"{api}/notes/{ready_note['id']}/chat", headers=h, timeout=30)
        assert r2.status_code == 200 and len(r2.json()) >= 2

    def test_smart_search(self, api, ready_note):
        r = requests.post(f"{api}/search/smart", json={"query": "activation onboarding"},
                          headers=ready_note["h"], timeout=120)
        assert r.status_code == 200
        assert r.json()["total"] >= 1


# --- Reminders / actions propagation ---
class TestReminders:
    def test_reminder_done_propagates(self, api, ready_note):
        h = ready_note["h"]
        actions = requests.get(f"{api}/actions", headers=h, timeout=30).json()
        assert isinstance(actions, list)
        aid = actions[0]["id"] if actions else None
        r = requests.post(f"{api}/reminders", json={"text": "TEST relance", "note_id": ready_note["id"],
                                                    "action_id": aid, "due_at": "2026-08-01"},
                          headers=h, timeout=30)
        assert r.status_code == 200
        rid = r.json()["id"]
        r2 = requests.patch(f"{api}/reminders/{rid}", json={"done": True}, headers=h, timeout=30)
        assert r2.status_code == 200 and r2.json()["done"] is True
        # if action_id, ensure it's marked done on the note
        if aid:
            note = requests.get(f"{api}/notes/{ready_note['id']}", headers=h, timeout=30).json()
            match = next((a for a in note.get("actions", []) if a.get("id") == aid), None)
            assert match is None or match.get("done") is True
        requests.delete(f"{api}/reminders/{rid}", headers=h, timeout=30)


# --- Cross user security ---
class TestSecurity:
    def test_cross_user_note_not_found(self, api, ready_note, other_H):
        r = requests.get(f"{api}/notes/{ready_note['id']}", headers=other_H, timeout=30)
        assert r.status_code == 404

    def test_cross_user_share_delete(self, api, ready_note, other_H):
        # Attempt to revoke share for a note we don't own
        r = requests.delete(f"{api}/notes/{ready_note['id']}/share", headers=other_H, timeout=30)
        assert r.status_code in (404, 403)


# --- Insights ---
class TestInsights:
    def test_stats(self, api, H):
        r = requests.get(f"{api}/stats", headers=H, timeout=30)
        assert r.status_code == 200

    def test_analytics(self, api, H):
        r = requests.get(f"{api}/analytics", headers=H, timeout=30)
        assert r.status_code == 200

    def test_graph(self, api, H):
        r = requests.get(f"{api}/graph", headers=H, timeout=30)
        assert r.status_code == 200


# --- Account export + delete (isolated fresh account) ---
class TestAccountLifecycle:
    def test_export_and_delete_flow(self, api):
        tok = requests.post(f"{api}/auth/guest", timeout=30).json()["session_token"]
        h = {"Authorization": f"Bearer {tok}"}
        exp = requests.get(f"{api}/auth/export", headers=h, timeout=60)
        assert exp.status_code == 200
        d = requests.delete(f"{api}/auth/me", headers=h, timeout=30)
        assert d.status_code == 200
        me = requests.get(f"{api}/auth/me", headers=h, timeout=30)
        assert me.status_code == 401
