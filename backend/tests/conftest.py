import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback to frontend/.env value if not exported
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except FileNotFoundError:
        pass

assert BASE_URL, "REACT_APP_BACKEND_URL is not configured"


def _new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api_client():
    return _new_session()


@pytest.fixture(scope="session")
def admin_token():
    s = _new_session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@trading.com", "password": "password"},
               timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def master_token():
    s = _new_session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "masteruser@trading.com", "password": "password"},
               timeout=30)
    assert r.status_code == 200, f"Master login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def fresh_user():
    """Sign up a unique user once per session and return (token, user, email, password)."""
    s = _new_session()
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "Password123!"
    r = s.post(f"{BASE_URL}/api/auth/signup",
               json={"email": email, "password": password, "name": "Tester"},
               timeout=30)
    assert r.status_code == 200, f"Signup failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "token": body["token"],
        "user": body["user"],
        "email": email,
        "password": password,
    }


@pytest.fixture
def admin_client(admin_token):
    s = _new_session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture
def user_client(fresh_user):
    s = _new_session()
    s.headers.update({"Authorization": f"Bearer {fresh_user['token']}"})
    return s
