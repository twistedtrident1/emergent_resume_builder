import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend .env so we get MONGO_URL / DB_NAME
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend .env
    fe_env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture()
def seeded_user(mongo_db):
    """Create a synthetic user + session in MongoDB. Yields (user_doc, session_token).
    Cleans up after the test."""
    user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
    email = f"TEST_{uuid.uuid4().hex[:6]}@test.local"
    session_token = f"sess_TEST_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)

    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": "Test User",
        "picture": None,
        "created_at": now,
    }
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": now + timedelta(days=7),
        "created_at": now,
    }
    mongo_db.users.insert_one(user_doc)
    mongo_db.user_sessions.insert_one(session_doc)

    yield user_doc, session_token

    # cleanup
    mongo_db.users.delete_one({"user_id": user_id})
    mongo_db.user_sessions.delete_one({"session_token": session_token})
    mongo_db.tasks.delete_many({"user_id": user_id})
    mongo_db.completions.delete_many({"user_id": user_id})


@pytest.fixture()
def auth_headers(seeded_user):
    _, token = seeded_user
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture()
def second_seeded_user(mongo_db):
    """Independent second user + session for isolation tests."""
    user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
    email = f"TEST_{uuid.uuid4().hex[:6]}@test.local"
    session_token = f"sess_TEST_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)

    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": "Test User 2",
        "picture": None,
        "created_at": now,
    }
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": now + timedelta(days=7),
        "created_at": now,
    }
    mongo_db.users.insert_one(user_doc)
    mongo_db.user_sessions.insert_one(session_doc)

    yield user_doc, session_token

    mongo_db.users.delete_one({"user_id": user_id})
    mongo_db.user_sessions.delete_one({"session_token": session_token})
    mongo_db.tasks.delete_many({"user_id": user_id})
    mongo_db.completions.delete_many({"user_id": user_id})
