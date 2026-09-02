"""SmartNoter backend regression tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://doctor-assistant-12.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def guest_auth(api):
    r = api.post(f"{BASE_URL}/api/auth/guest", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data and "user" in data
    token = data["session_token"]
    return {"token": token, "user": data["user"], "headers": {"Authorization": f"Bearer {token}"}}


# ---------- Auth ----------
class TestAuth:
    def test_guest_login(self, guest_auth):
        assert guest_auth["user"].get("user_id")
        assert guest_auth["user"].get("email", "").startswith("guest_")

    def test_me(self, api, guest_auth):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json()["user_id"] == guest_auth["user"]["user_id"]

    def test_me_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- Templates ----------
class TestTemplates:
    def test_five_seeded(self, api, guest_auth):
        r = api.get(f"{BASE_URL}/api/templates", headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        templates = r.json()
        names = {t["name"] for t in templates}
        expected = {"Consultation SOAP", "Consultation rapide", "Réunion classique", "Notes de cours", "Analyse approfondie"}
        assert expected.issubset(names), f"Missing: {expected - names}"
        soap = next(t for t in templates if t["name"] == "Consultation SOAP")
        assert soap.get("is_medical") is True


# ---------- Folders ----------
class TestFolders:
    def test_default_folders_seeded(self, api, guest_auth):
        r = api.get(f"{BASE_URL}/api/folders", headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        folders = r.json()
        names = {f["name"] for f in folders}
        assert {"Patients", "Réunions", "Personnel"}.issubset(names)

    def test_create_and_delete_folder(self, api, guest_auth):
        r = api.post(f"{BASE_URL}/api/folders", json={"name": "TEST_Folder", "color": "#FF0000"},
                     headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        fid = r.json()["id"]
        assert r.json()["name"] == "TEST_Folder"
        # verify persistence
        r2 = api.get(f"{BASE_URL}/api/folders", headers=guest_auth["headers"], timeout=15)
        assert any(f["id"] == fid for f in r2.json())
        # delete
        r3 = api.delete(f"{BASE_URL}/api/folders/{fid}", headers=guest_auth["headers"], timeout=15)
        assert r3.status_code == 200
        r4 = api.get(f"{BASE_URL}/api/folders", headers=guest_auth["headers"], timeout=15)
        assert not any(f["id"] == fid for f in r4.json())


# ---------- Notes (LLM) ----------
class TestNotes:
    @pytest.fixture(scope="class")
    def soap_template_id(self, api, guest_auth):
        r = api.get(f"{BASE_URL}/api/templates", headers=guest_auth["headers"], timeout=15)
        return next(t["id"] for t in r.json() if t["name"] == "Consultation SOAP")

    @pytest.fixture(scope="class")
    def created_note(self, api, guest_auth, soap_template_id):
        payload = {
            "title": "TEST_Consultation",
            "text": "Patient de 45 ans, homme, se plaint de céphalées frontales depuis 3 jours. "
                    "TA 130/85. Pas de fièvre. Examen neurologique normal. "
                    "Suspicion de migraine sans aura. Prescription: paracétamol 1g x3/j. "
                    "Contrôle dans 7 jours.",
            "template_id": soap_template_id,
            "language": "fr",
        }
        r = api.post(f"{BASE_URL}/api/notes/from-text", json=payload,
                     headers=guest_auth["headers"], timeout=120)
        assert r.status_code == 200, r.text
        return r.json()

    def test_from_text_soap(self, created_note):
        assert created_note["status"] == "ready"
        assert created_note["summary"], "Summary empty"
        assert isinstance(created_note["actions"], list)
        assert isinstance(created_note["plan"], list)
        assert isinstance(created_note["tags"], list)
        # SOAP markdown check
        s = created_note["summary"]
        assert any(k in s for k in ["Subjectif", "Objectif", "Analyse", "Plan", "S)", "O)", "A)", "P)"]), \
            f"SOAP structure missing in summary: {s[:200]}"

    def test_list_notes(self, api, guest_auth, created_note):
        r = api.get(f"{BASE_URL}/api/notes", headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        assert any(n["id"] == created_note["id"] for n in r.json())

    def test_get_note(self, api, guest_auth, created_note):
        r = api.get(f"{BASE_URL}/api/notes/{created_note['id']}",
                    headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json()["transcription"]  # full transcription present

    def test_patch_note(self, api, guest_auth, created_note):
        r = api.patch(f"{BASE_URL}/api/notes/{created_note['id']}",
                      json={"title": "TEST_Updated"},
                      headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        r2 = api.get(f"{BASE_URL}/api/notes/{created_note['id']}",
                     headers=guest_auth["headers"], timeout=15)
        assert r2.json()["title"] == "TEST_Updated"

    def test_delete_note(self, api, guest_auth, created_note):
        r = api.delete(f"{BASE_URL}/api/notes/{created_note['id']}",
                       headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        r2 = api.get(f"{BASE_URL}/api/notes/{created_note['id']}",
                     headers=guest_auth["headers"], timeout=15)
        assert r2.status_code == 404


# ---------- Stats ----------
class TestStats:
    def test_stats(self, api, guest_auth):
        r = api.get(f"{BASE_URL}/api/stats", headers=guest_auth["headers"], timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_notes", "total_folders", "total_duration_sec"):
            assert k in d and isinstance(d[k], int)
