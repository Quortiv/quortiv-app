import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://doctor-assistant-12.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"


@pytest.fixture(scope="session")
def api():
    return API


@pytest.fixture(scope="session")
def guest_token(api):
    r = requests.post(f"{api}/auth/guest", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def H(guest_token):
    return {"Authorization": f"Bearer {guest_token}"}


@pytest.fixture(scope="session")
def other_H(api):
    r = requests.post(f"{api}/auth/guest", timeout=30)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['session_token']}"}
