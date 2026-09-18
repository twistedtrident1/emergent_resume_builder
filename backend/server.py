import os
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Setup ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
EMERGENT_SESSION_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_tz_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime


class SessionRequest(BaseModel):
    session_id: str


class TaskCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    recurring: bool = False  # True = appears every day, False = single date
    date: Optional[str] = None  # YYYY-MM-DD (for one-time tasks)


class TaskPatch(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None  # only for one-time tasks (snooze)


class ReorderItem(BaseModel):
    id: str
    sort_index: int


class ReorderRequest(BaseModel):
    items: List[ReorderItem]


class ThoughtCreate(BaseModel):
    text: str


class Task(BaseModel):
    id: str
    user_id: str
    title: str
    notes: Optional[str] = None
    recurring: bool
    date: Optional[str] = None
    created_at: datetime


class TaskWithStatus(BaseModel):
    id: str
    title: str
    notes: Optional[str] = None
    recurring: bool
    date: Optional[str] = None
    completed: bool


class DailyContent(BaseModel):
    date: str
    joke: str
    fact: str


# ---------- Auth dep ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = ensure_tz_aware(session["expires_at"])
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Auth endpoints ----------
@api_router.post("/auth/session")
async def create_session(body: SessionRequest):
    # Verify session_id with Emergent
    async with httpx.AsyncClient(timeout=15.0) as c:
        resp = await c.get(EMERGENT_SESSION_API, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = resp.json()

    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Malformed session data")

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = new_id("user")
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": now_utc(),
            }
        )

    # Store session
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user_id,
                "expires_at": now_utc() + timedelta(days=7),
                "created_at": now_utc(),
            }
        },
        upsert=True,
    )

    return {
        "session_token": session_token,
        "user": {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        },
    }


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
    }


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Tasks ----------
@api_router.get("/tasks")
async def list_tasks(date: str, user=Depends(get_current_user)):
    """Return tasks scheduled for `date` (YYYY-MM-DD): all recurring + one-time matching date.
    Excludes tasks the user has skipped for that specific date.
    """
    cursor = db.tasks.find(
        {
            "user_id": user["user_id"],
            "$or": [{"recurring": True}, {"recurring": False, "date": date}],
        },
        {"_id": 0},
    ).sort([("sort_index", 1), ("created_at", 1)])
    tasks = await cursor.to_list(500)

    completions = await db.completions.find(
        {"user_id": user["user_id"], "date": date},
        {"_id": 0, "task_id": 1},
    ).to_list(500)
    completed_set = {c["task_id"] for c in completions}

    skips = await db.skips.find(
        {"user_id": user["user_id"], "date": date},
        {"_id": 0, "task_id": 1},
    ).to_list(500)
    skipped_set = {s["task_id"] for s in skips}

    out = []
    for t in tasks:
        if t["id"] in skipped_set:
            continue
        out.append(
            {
                "id": t["id"],
                "title": t["title"],
                "notes": t.get("notes"),
                "recurring": t["recurring"],
                "date": t.get("date"),
                "completed": t["id"] in completed_set,
            }
        )
    return out


@api_router.post("/tasks")
async def create_task(body: TaskCreate, user=Depends(get_current_user)):
    if not body.recurring and not body.date:
        raise HTTPException(status_code=400, detail="One-time tasks require a date")
    # Place new task at end of current user's list
    last = await db.tasks.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "sort_index": 1},
        sort=[("sort_index", -1)],
    )
    next_idx = (last.get("sort_index", 0) + 1) if last and last.get("sort_index") is not None else 1
    task = {
        "id": new_id("task"),
        "user_id": user["user_id"],
        "title": body.title.strip(),
        "notes": body.notes,
        "recurring": body.recurring,
        "date": body.date if not body.recurring else None,
        "sort_index": next_idx,
        "created_at": now_utc(),
    }
    if not task["title"]:
        raise HTTPException(status_code=400, detail="Title required")
    await db.tasks.insert_one(task)
    return {
        "id": task["id"],
        "title": task["title"],
        "notes": task["notes"],
        "recurring": task["recurring"],
        "date": task["date"],
        "completed": False,
    }


@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskPatch, user=Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id, "user_id": user["user_id"]}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updates: dict = {}
    if body.title is not None:
        t = body.title.strip()
        if not t:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        updates["title"] = t
    if body.notes is not None:
        updates["notes"] = body.notes
    if body.date is not None:
        if task["recurring"]:
            raise HTTPException(status_code=400, detail="Recurring tasks have no date")
        updates["date"] = body.date
    if updates:
        await db.tasks.update_one({"id": task_id, "user_id": user["user_id"]}, {"$set": updates})
    return {"ok": True}


@api_router.post("/tasks/reorder")
async def reorder_tasks(body: ReorderRequest, user=Depends(get_current_user)):
    for item in body.items:
        await db.tasks.update_one(
            {"id": item.id, "user_id": user["user_id"]},
            {"$set": {"sort_index": item.sort_index}},
        )
    return {"ok": True}


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    result = await db.tasks.delete_one({"id": task_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    # Also clear completions
    await db.completions.delete_many({"task_id": task_id, "user_id": user["user_id"]})
    return {"ok": True}


@api_router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, date: str, user=Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id, "user_id": user["user_id"]}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.completions.update_one(
        {"task_id": task_id, "user_id": user["user_id"], "date": date},
        {
            "$set": {
                "task_id": task_id,
                "user_id": user["user_id"],
                "date": date,
                "completed_at": now_utc(),
            }
        },
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/tasks/{task_id}/uncomplete")
async def uncomplete_task(task_id: str, date: str, user=Depends(get_current_user)):
    await db.completions.delete_one(
        {"task_id": task_id, "user_id": user["user_id"], "date": date}
    )
    return {"ok": True}


@api_router.post("/tasks/{task_id}/skip")
async def skip_task(task_id: str, date: str, user=Depends(get_current_user)):
    """Hide a (typically recurring) task for `date` without affecting future dates."""
    task = await db.tasks.find_one({"id": task_id, "user_id": user["user_id"]}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.skips.update_one(
        {"task_id": task_id, "user_id": user["user_id"], "date": date},
        {
            "$set": {
                "task_id": task_id,
                "user_id": user["user_id"],
                "date": date,
                "skipped_at": now_utc(),
            }
        },
        upsert=True,
    )
    return {"ok": True}


# ---------- Streak ----------
# ---------- Thoughts (brain dump) ----------
@api_router.get("/thoughts")
async def list_thoughts(user=Depends(get_current_user)):
    cursor = db.thoughts.find(
        {"user_id": user["user_id"], "archived": {"$ne": True}},
        {"_id": 0, "user_id": 0},
    ).sort("created_at", -1)
    return await cursor.to_list(200)


@api_router.post("/thoughts")
async def create_thought(body: ThoughtCreate, user=Depends(get_current_user)):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    doc = {
        "id": new_id("thought"),
        "user_id": user["user_id"],
        "text": text,
        "created_at": now_utc(),
        "archived": False,
    }
    await db.thoughts.insert_one(doc)
    return {"id": doc["id"], "text": doc["text"], "created_at": doc["created_at"], "archived": False}


@api_router.delete("/thoughts/{thought_id}")
async def delete_thought(thought_id: str, user=Depends(get_current_user)):
    res = await db.thoughts.delete_one({"id": thought_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Thought not found")
    return {"ok": True}


@api_router.post("/thoughts/{thought_id}/convert")
async def convert_thought(thought_id: str, date: str, user=Depends(get_current_user)):
    thought = await db.thoughts.find_one(
        {"id": thought_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not thought:
        raise HTTPException(status_code=404, detail="Thought not found")
    # Create one-time task for the given date
    last = await db.tasks.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "sort_index": 1},
        sort=[("sort_index", -1)],
    )
    next_idx = (last.get("sort_index", 0) + 1) if last and last.get("sort_index") is not None else 1
    task = {
        "id": new_id("task"),
        "user_id": user["user_id"],
        "title": thought["text"],
        "notes": None,
        "recurring": False,
        "date": date,
        "sort_index": next_idx,
        "created_at": now_utc(),
    }
    await db.tasks.insert_one(task)
    await db.thoughts.update_one(
        {"id": thought_id, "user_id": user["user_id"]},
        {"$set": {"archived": True}},
    )
    return {
        "id": task["id"],
        "title": task["title"],
        "notes": task["notes"],
        "recurring": task["recurring"],
        "date": task["date"],
        "completed": False,
    }


@api_router.get("/streak")
async def get_streak(date: str, user=Depends(get_current_user)):
    """Return current streak ending on `date` and lifetime best streak.
    A day with zero completions breaks the current chain.
    """
    from datetime import date as date_cls

    try:
        anchor = date_cls.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")

    # Get distinct dates that have any completion for this user
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": "$date"}},
    ]
    rows = await db.completions.aggregate(pipeline).to_list(5000)
    completed_days = {r["_id"] for r in rows}

    # Current streak ending at anchor
    streak = 0
    cursor = anchor
    while cursor.isoformat() in completed_days:
        streak += 1
        cursor = date_cls.fromordinal(cursor.toordinal() - 1)

    # Lifetime best: walk sorted completion dates and find longest consecutive run
    best = 0
    if completed_days:
        sorted_days = sorted(date_cls.fromisoformat(d) for d in completed_days)
        run = 1
        best = 1
        for i in range(1, len(sorted_days)):
            if sorted_days[i].toordinal() == sorted_days[i - 1].toordinal() + 1:
                run += 1
                if run > best:
                    best = run
            else:
                run = 1

    today_done = anchor.isoformat() in completed_days
    return {
        "date": date,
        "streak": streak,
        "best_streak": best,
        "today_completed": today_done,
    }


# ---------- Daily content (joke + fact) ----------
async def generate_daily_content(date: str) -> dict:
    """Generate a daily joke + interesting fact via Claude. Cache per date globally."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    # Lazy import (only when needed)
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    system_msg = (
        "You generate gentle, ADHD-friendly daily content. Always respond with strict JSON only, "
        "no markdown fences, no extra commentary. The JSON has two keys: 'joke' and 'fact'. "
        "'joke' is a short, wholesome, family-friendly joke (1-2 sentences, no dark humor). "
        "'fact' is a fascinating, uplifting science/nature/history fact (1-2 sentences, calm tone, no anxiety triggers)."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"daily-{date}",
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-6")

    user_message = UserMessage(
        text=f"Generate today's joke and fact for date {date}. Respond as JSON only: "
        f'{{"joke": "...", "fact": "..."}}'
    )

    # Use non-streaming send_message for a single short JSON payload
    try:
        response = await chat.send_message(user_message)
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {e}")

    text = response if isinstance(response, str) else str(response)
    # Try to parse JSON; tolerate stray text
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        payload = json.loads(text)
    except Exception:
        # Try to find JSON inside text
        import re
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            raise HTTPException(status_code=502, detail="LLM returned invalid JSON")
        payload = json.loads(m.group(0))

    joke = str(payload.get("joke", "")).strip()
    fact = str(payload.get("fact", "")).strip()
    if not joke or not fact:
        raise HTTPException(status_code=502, detail="LLM returned empty content")
    return {"joke": joke, "fact": fact}


FORCE_REGEN_COOLDOWN_SEC = 60


@api_router.get("/daily-content")
async def get_daily_content(date: str, force: bool = False, user=Depends(get_current_user)):
    if force:
        # Rate-limit: at most one forced regeneration per user per minute.
        last_at = user.get("last_force_at")
        if last_at is not None:
            last_at = ensure_tz_aware(last_at)
            elapsed = (now_utc() - last_at).total_seconds()
            if elapsed < FORCE_REGEN_COOLDOWN_SEC:
                wait = int(FORCE_REGEN_COOLDOWN_SEC - elapsed)
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {wait}s before refreshing again",
                )
        # Mark the regeneration before doing the LLM call so concurrent forces are blocked.
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"last_force_at": now_utc()}},
        )
    else:
        cached = await db.daily_content.find_one({"date": date}, {"_id": 0})
        if cached:
            return {"date": date, "joke": cached["joke"], "fact": cached["fact"]}

    content = await generate_daily_content(date)
    await db.daily_content.update_one(
        {"date": date},
        {
            "$set": {
                "date": date,
                "joke": content["joke"],
                "fact": content["fact"],
                "created_at": now_utc(),
            }
        },
        upsert=True,
    )
    return {"date": date, "joke": content["joke"], "fact": content["fact"]}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "ADHD Day Planner API"}


# ---------- App wiring ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.tasks.create_index([("user_id", 1), ("recurring", 1)])
    await db.tasks.create_index([("user_id", 1), ("date", 1)])
    await db.completions.create_index(
        [("user_id", 1), ("task_id", 1), ("date", 1)], unique=True
    )
    await db.daily_content.create_index("date", unique=True)
    await db.thoughts.create_index([("user_id", 1), ("created_at", -1)])
    await db.skips.create_index(
        [("user_id", 1), ("task_id", 1), ("date", 1)], unique=True
    )
    await db.skips.create_index([("user_id", 1), ("date", 1)])
    logger.info("Mongo indexes ensured")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
