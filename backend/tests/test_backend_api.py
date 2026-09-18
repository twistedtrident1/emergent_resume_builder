"""Backend API tests for ADHD Day Planner.
Covers: health, auth (negative cases), seeded session auth flow, tasks CRUD,
recurring vs one-time visibility, daily-content generation + cache, CORS.
"""
import os
import requests
from datetime import datetime, timezone, timedelta


def _url(base, path):
    return f"{base}{path}"


# ---------- Health ----------
class TestHealth:
    def test_root_health(self, api_client, base_url):
        r = api_client.get(_url(base_url, "/api/"))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data
        assert "ADHD" in data["message"]


# ---------- Auth: negative cases ----------
class TestAuthNegative:
    def test_session_with_invalid_id(self, api_client, base_url):
        r = api_client.post(
            _url(base_url, "/api/auth/session"),
            json={"session_id": "definitely-invalid-xyz-123"},
        )
        assert r.status_code == 401, r.text

    def test_me_without_token(self, api_client, base_url):
        r = requests.get(_url(base_url, "/api/auth/me"))
        assert r.status_code == 401

    def test_me_with_bad_token(self, api_client, base_url):
        r = requests.get(
            _url(base_url, "/api/auth/me"),
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert r.status_code == 401

    def test_logout_without_token_returns_ok(self, api_client, base_url):
        r = requests.post(_url(base_url, "/api/auth/logout"))
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_tasks_without_token(self, api_client, base_url):
        r = requests.get(_url(base_url, "/api/tasks"), params={"date": "2026-02-15"})
        assert r.status_code == 401

    def test_daily_content_without_token(self, api_client, base_url):
        r = requests.get(
            _url(base_url, "/api/daily-content"), params={"date": "2026-02-15"}
        )
        assert r.status_code == 401


# ---------- CORS ----------
class TestCORS:
    def test_cors_allows_any_origin(self, api_client, base_url):
        # Simulate an Origin from a mobile WebView or web preview
        r = requests.get(
            _url(base_url, "/api/"),
            headers={"Origin": "https://random-app.example.com"},
        )
        assert r.status_code == 200
        acao = r.headers.get("access-control-allow-origin") or r.headers.get(
            "Access-Control-Allow-Origin"
        )
        # Expect either '*' or echo of origin
        assert acao in ("*", "https://random-app.example.com"), f"Got CORS header: {acao}"


# ---------- Auth: seeded session ----------
class TestSeededAuth:
    def test_me_with_seeded_session(self, seeded_user, auth_headers, base_url):
        user_doc, _ = seeded_user
        r = requests.get(_url(base_url, "/api/auth/me"), headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == user_doc["user_id"]
        assert data["email"] == user_doc["email"]
        assert data["name"] == user_doc["name"]

    def test_expired_session_rejected(self, mongo_db, base_url):
        # Insert a session with expired expires_at
        import uuid
        user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
        token = f"sess_TEST_EXP_{uuid.uuid4().hex}"
        now = datetime.now(timezone.utc)
        mongo_db.users.insert_one(
            {"user_id": user_id, "email": f"TEST_exp_{user_id}@t.local",
             "name": "Exp", "picture": None, "created_at": now}
        )
        mongo_db.user_sessions.insert_one(
            {"session_token": token, "user_id": user_id,
             "expires_at": now - timedelta(days=1), "created_at": now}
        )
        try:
            r = requests.get(
                _url(base_url, "/api/auth/me"),
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 401
        finally:
            mongo_db.users.delete_one({"user_id": user_id})
            mongo_db.user_sessions.delete_one({"session_token": token})


# ---------- Tasks ----------
class TestTasks:
    def test_create_recurring_task_visible_on_any_date(self, auth_headers, base_url):
        # Create recurring
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_Drink water", "recurring": True},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        task = r.json()
        assert task["title"] == "TEST_Drink water"
        assert task["recurring"] is True
        assert task["completed"] is False
        task_id = task["id"]

        # Visible on date A
        for date in ("2026-02-15", "2030-12-01"):
            r2 = requests.get(
                _url(base_url, "/api/tasks"),
                params={"date": date},
                headers=auth_headers,
            )
            assert r2.status_code == 200
            ids = [t["id"] for t in r2.json()]
            assert task_id in ids, f"recurring task not visible on {date}"

    def test_one_time_task_only_on_assigned_date(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_Dentist", "recurring": False, "date": "2026-03-10"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        task_id = r.json()["id"]

        # On the assigned date
        r2 = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-03-10"},
            headers=auth_headers,
        )
        assert task_id in [t["id"] for t in r2.json()]

        # Not on a different date
        r3 = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-03-11"},
            headers=auth_headers,
        )
        assert task_id not in [t["id"] for t in r3.json()]

    def test_one_time_task_without_date_returns_400(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_NoDate", "recurring": False},
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_complete_uncomplete_flow(self, auth_headers, base_url):
        # Create
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_Workout", "recurring": True},
            headers=auth_headers,
        )
        task_id = r.json()["id"]
        date = "2026-02-15"

        # Complete
        rc = requests.post(
            _url(base_url, f"/api/tasks/{task_id}/complete"),
            params={"date": date},
            headers=auth_headers,
        )
        assert rc.status_code == 200

        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": date},
            headers=auth_headers,
        )
        task = next(t for t in rl.json() if t["id"] == task_id)
        assert task["completed"] is True

        # Uncomplete
        ru = requests.post(
            _url(base_url, f"/api/tasks/{task_id}/uncomplete"),
            params={"date": date},
            headers=auth_headers,
        )
        assert ru.status_code == 200

        rl2 = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": date},
            headers=auth_headers,
        )
        task = next(t for t in rl2.json() if t["id"] == task_id)
        assert task["completed"] is False

    def test_delete_task(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_Delete me", "recurring": True},
            headers=auth_headers,
        )
        task_id = r.json()["id"]

        rd = requests.delete(
            _url(base_url, f"/api/tasks/{task_id}"), headers=auth_headers
        )
        assert rd.status_code == 200

        # Verify gone (via GET tasks list)
        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert task_id not in [t["id"] for t in rl.json()]

        # Deleting again returns 404
        rd2 = requests.delete(
            _url(base_url, f"/api/tasks/{task_id}"), headers=auth_headers
        )
        assert rd2.status_code == 404


# ---------- Streak (Iteration 2) ----------
class TestStreak:
    def test_streak_requires_auth(self, base_url):
        r = requests.get(_url(base_url, "/api/streak"), params={"date": "2026-02-15"})
        assert r.status_code == 401

    def test_streak_invalid_date_returns_400(self, auth_headers, base_url):
        r = requests.get(
            _url(base_url, "/api/streak"),
            params={"date": "not-a-date"},
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_streak_zero_with_no_completions(self, auth_headers, base_url):
        r = requests.get(
            _url(base_url, "/api/streak"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["streak"] == 0
        assert data["today_completed"] is False

    def test_streak_three_consecutive_days(self, auth_headers, base_url):
        # Create recurring task
        rc = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_StreakTask", "recurring": True},
            headers=auth_headers,
        )
        task_id = rc.json()["id"]
        for d in ("2026-02-13", "2026-02-14", "2026-02-15"):
            r = requests.post(
                _url(base_url, f"/api/tasks/{task_id}/complete"),
                params={"date": d},
                headers=auth_headers,
            )
            assert r.status_code == 200, r.text
        r = requests.get(
            _url(base_url, "/api/streak"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["streak"] == 3, data
        assert data["today_completed"] is True

    def test_streak_gap_breaks_chain(self, auth_headers, base_url):
        rc = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_GapTask", "recurring": True},
            headers=auth_headers,
        )
        task_id = rc.json()["id"]
        # Complete on 02-13 and 02-15 but NOT 02-14
        for d in ("2026-02-13", "2026-02-15"):
            r = requests.post(
                _url(base_url, f"/api/tasks/{task_id}/complete"),
                params={"date": d},
                headers=auth_headers,
            )
            assert r.status_code == 200
        r = requests.get(
            _url(base_url, "/api/streak"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["streak"] == 1, data
        assert data["today_completed"] is True


# ---------- PATCH /api/tasks/{id} (Iteration 2) ----------
class TestPatchTask:
    def test_patch_requires_auth(self, base_url):
        r = requests.patch(_url(base_url, "/api/tasks/nonexistent"), json={"title": "x"})
        assert r.status_code == 401

    def test_patch_title_persists(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_Original", "recurring": True},
            headers=auth_headers,
        )
        task_id = r.json()["id"]
        rp = requests.patch(
            _url(base_url, f"/api/tasks/{task_id}"),
            json={"title": "TEST_Renamed"},
            headers=auth_headers,
        )
        assert rp.status_code == 200, rp.text
        # Verify persistence
        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        t = next(t for t in rl.json() if t["id"] == task_id)
        assert t["title"] == "TEST_Renamed"

    def test_patch_date_on_recurring_returns_400(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_RecurNoDate", "recurring": True},
            headers=auth_headers,
        )
        task_id = r.json()["id"]
        rp = requests.patch(
            _url(base_url, f"/api/tasks/{task_id}"),
            json={"date": "2026-02-16"},
            headers=auth_headers,
        )
        assert rp.status_code == 400, rp.text

    def test_snooze_one_time_task(self, auth_headers, base_url):
        # Create one-time task on 2026-02-15
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_Snooze", "recurring": False, "date": "2026-02-15"},
            headers=auth_headers,
        )
        task_id = r.json()["id"]

        # Confirm visible on 02-15
        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert task_id in [t["id"] for t in rl.json()]

        # Snooze to 02-16
        rp = requests.patch(
            _url(base_url, f"/api/tasks/{task_id}"),
            json={"date": "2026-02-16"},
            headers=auth_headers,
        )
        assert rp.status_code == 200, rp.text

        # No longer visible on 02-15
        rl1 = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert task_id not in [t["id"] for t in rl1.json()]

        # Visible on 02-16
        rl2 = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-16"},
            headers=auth_headers,
        )
        assert task_id in [t["id"] for t in rl2.json()]


# ---------- POST /api/tasks/reorder (Iteration 2) ----------
class TestReorder:
    def test_reorder_requires_auth(self, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks/reorder"),
            json={"items": [{"id": "x", "sort_index": 1}]},
        )
        assert r.status_code == 401

    def test_new_tasks_have_ascending_sort_index(self, auth_headers, base_url):
        ids = []
        for i in range(3):
            r = requests.post(
                _url(base_url, "/api/tasks"),
                json={"title": f"TEST_Order{i}", "recurring": True},
                headers=auth_headers,
            )
            assert r.status_code == 200
            ids.append(r.json()["id"])

        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        listed = [t["id"] for t in rl.json() if t["id"] in ids]
        assert listed == ids, f"Expected creation order {ids}, got {listed}"

    def test_reorder_persists(self, auth_headers, base_url):
        ids = []
        for i in range(3):
            r = requests.post(
                _url(base_url, "/api/tasks"),
                json={"title": f"TEST_Reorder{i}", "recurring": True},
                headers=auth_headers,
            )
            ids.append(r.json()["id"])

        # Reverse order
        reorder_payload = {
            "items": [
                {"id": ids[2], "sort_index": 1},
                {"id": ids[1], "sort_index": 2},
                {"id": ids[0], "sort_index": 3},
            ]
        }
        rr = requests.post(
            _url(base_url, "/api/tasks/reorder"),
            json=reorder_payload,
            headers=auth_headers,
        )
        assert rr.status_code == 200, rr.text

        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        listed = [t["id"] for t in rl.json() if t["id"] in ids]
        assert listed == [ids[2], ids[1], ids[0]], f"Reorder did not persist: {listed}"


# ---------- Daily content ----------
class TestDailyContent:
    def test_daily_content_generates_and_caches(self, auth_headers, base_url, mongo_db):
        # Use a unique date to force generation
        unique_date = f"2099-01-{(datetime.now().microsecond % 28) + 1:02d}"
        # ensure not cached
        mongo_db.daily_content.delete_one({"date": unique_date})

        try:
            r = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date},
                headers=auth_headers,
                timeout=60,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["date"] == unique_date
            assert isinstance(data["joke"], str) and len(data["joke"]) > 0
            assert isinstance(data["fact"], str) and len(data["fact"]) > 0

            # Second call should be cached & fast; values equal
            r2 = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date},
                headers=auth_headers,
                timeout=30,
            )
            assert r2.status_code == 200
            data2 = r2.json()
            assert data2["joke"] == data["joke"]
            assert data2["fact"] == data["fact"]
        finally:
            mongo_db.daily_content.delete_one({"date": unique_date})


# ---------- Daily content rate-limit (Iteration 3) ----------
class TestDailyContentRateLimit:
    def test_force_true_rate_limited_per_user(self, auth_headers, base_url, mongo_db, seeded_user):
        """First force=true regenerates (200); immediate second force=true returns 429.
        Cached (non-force) read still 200 even within cooldown window."""
        user_doc, _ = seeded_user
        unique_date = f"2098-03-{(datetime.now().microsecond % 28) + 1:02d}"
        # Ensure clean state
        mongo_db.daily_content.delete_one({"date": unique_date})
        mongo_db.users.update_one({"user_id": user_doc["user_id"]}, {"$unset": {"last_force_at": ""}})

        try:
            # 1) First force=true -> 200 with joke+fact (real LLM call, allow time)
            r1 = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date, "force": "true"},
                headers=auth_headers,
                timeout=60,
            )
            assert r1.status_code == 200, r1.text
            d1 = r1.json()
            assert d1["date"] == unique_date
            assert isinstance(d1["joke"], str) and len(d1["joke"]) > 0
            assert isinstance(d1["fact"], str) and len(d1["fact"]) > 0

            # 2) Immediate second force=true -> 429 with wait info
            r2 = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date, "force": "true"},
                headers=auth_headers,
                timeout=10,
            )
            assert r2.status_code == 429, r2.text
            body = r2.json()
            detail = body.get("detail", "")
            assert "wait" in detail.lower() or "s" in detail, f"Unexpected 429 detail: {detail}"

            # 3) Cached (non-force) read still 200 within cooldown
            r3 = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date},
                headers=auth_headers,
                timeout=10,
            )
            assert r3.status_code == 200, r3.text
            d3 = r3.json()
            assert d3["joke"] == d1["joke"]
            assert d3["fact"] == d1["fact"]
        finally:
            mongo_db.daily_content.delete_one({"date": unique_date})
            mongo_db.users.update_one(
                {"user_id": user_doc["user_id"]}, {"$unset": {"last_force_at": ""}}
            )

    def test_force_true_rate_limit_is_per_user(
        self, auth_headers, base_url, mongo_db, seeded_user, second_seeded_user
    ):
        """User A's cooldown must NOT block User B's force=true."""
        user_a, _ = seeded_user
        user_b, token_b = second_seeded_user
        headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

        unique_date = f"2097-04-{(datetime.now().microsecond % 28) + 1:02d}"
        mongo_db.daily_content.delete_one({"date": unique_date})
        mongo_db.users.update_one({"user_id": user_a["user_id"]}, {"$unset": {"last_force_at": ""}})
        mongo_db.users.update_one({"user_id": user_b["user_id"]}, {"$unset": {"last_force_at": ""}})

        try:
            # A force=true once
            rA = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date, "force": "true"},
                headers=auth_headers,
                timeout=60,
            )
            assert rA.status_code == 200, rA.text

            # A's immediate second call -> 429
            rA2 = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date, "force": "true"},
                headers=auth_headers,
                timeout=10,
            )
            assert rA2.status_code == 429, rA2.text

            # B's force=true at same time -> NOT blocked (200)
            rB = requests.get(
                _url(base_url, "/api/daily-content"),
                params={"date": unique_date, "force": "true"},
                headers=headers_b,
                timeout=60,
            )
            assert rB.status_code == 200, rB.text
            dB = rB.json()
            assert isinstance(dB["joke"], str) and len(dB["joke"]) > 0
        finally:
            mongo_db.daily_content.delete_one({"date": unique_date})
            mongo_db.users.update_one(
                {"user_id": user_a["user_id"]}, {"$unset": {"last_force_at": ""}}
            )
            mongo_db.users.update_one(
                {"user_id": user_b["user_id"]}, {"$unset": {"last_force_at": ""}}
            )


# ---------- best_streak field (Iteration 3) ----------
class TestBestStreak:
    def test_best_streak_zero_with_no_completions(self, auth_headers, base_url):
        r = requests.get(
            _url(base_url, "/api/streak"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "best_streak" in data, data
        assert data["best_streak"] == 0
        assert data["streak"] == 0

    def test_best_streak_two_runs_three_and_five(self, auth_headers, base_url, mongo_db, seeded_user):
        """3-day run, gap, 5-day run -> best_streak=5."""
        user_doc, _ = seeded_user
        # Insert completions directly
        from datetime import datetime as _dt
        # Run A: 2026-01-01..03 (3 days)
        run_a = ["2026-01-01", "2026-01-02", "2026-01-03"]
        # Gap on 2026-01-04
        # Run B: 2026-01-05..09 (5 days)
        run_b = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]
        task_id = "task_TEST_beststreak"
        docs = []
        for d in run_a + run_b:
            docs.append(
                {
                    "task_id": task_id,
                    "user_id": user_doc["user_id"],
                    "date": d,
                    "completed_at": _dt.now(timezone.utc),
                }
            )
        mongo_db.completions.insert_many(docs)

        try:
            # Anchor in middle (no completion that day) - current streak 0, best 5
            r = requests.get(
                _url(base_url, "/api/streak"),
                params={"date": "2026-01-15"},
                headers=auth_headers,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["best_streak"] == 5, data
            assert data["streak"] == 0
            assert data["today_completed"] is False

            # Anchor at end of run B -> current streak 5, best 5
            r2 = requests.get(
                _url(base_url, "/api/streak"),
                params={"date": "2026-01-09"},
                headers=auth_headers,
            )
            assert r2.status_code == 200
            d2 = r2.json()
            assert d2["streak"] == 5
            assert d2["best_streak"] == 5
            assert d2["today_completed"] is True
        finally:
            mongo_db.completions.delete_many({"user_id": user_doc["user_id"]})

    def test_best_streak_single_run_of_four(self, auth_headers, base_url, mongo_db, seeded_user):
        user_doc, _ = seeded_user
        from datetime import datetime as _dt
        days = ["2026-05-10", "2026-05-11", "2026-05-12", "2026-05-13"]
        docs = [
            {
                "task_id": "task_TEST_singleRun",
                "user_id": user_doc["user_id"],
                "date": d,
                "completed_at": _dt.now(timezone.utc),
            }
            for d in days
        ]
        mongo_db.completions.insert_many(docs)
        try:
            r = requests.get(
                _url(base_url, "/api/streak"),
                params={"date": "2026-05-13"},
                headers=auth_headers,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["best_streak"] == 4, data
            assert data["streak"] == 4, data
            assert data["today_completed"] is True
        finally:
            mongo_db.completions.delete_many({"user_id": user_doc["user_id"]})



# ---------- Thoughts / Brain Dump (Iteration 4) ----------
class TestThoughts:
    def test_thoughts_requires_auth(self, base_url):
        r = requests.get(_url(base_url, "/api/thoughts"))
        assert r.status_code == 401

    def test_thoughts_initially_empty(self, auth_headers, base_url):
        r = requests.get(_url(base_url, "/api/thoughts"), headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_create_thought_and_list_newest_first(self, auth_headers, base_url):
        # Create two thoughts in order
        r1 = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": "remember dentist"},
            headers=auth_headers,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["text"] == "remember dentist"
        assert d1.get("archived") is False
        assert "id" in d1 and d1["id"].startswith("thought_")

        # Second
        r2 = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": "call mom"},
            headers=auth_headers,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()

        # List
        rl = requests.get(_url(base_url, "/api/thoughts"), headers=auth_headers)
        assert rl.status_code == 200
        items = rl.json()
        ids = [t["id"] for t in items]
        # Both present
        assert d1["id"] in ids and d2["id"] in ids
        # Newest first: d2 was created after d1
        assert ids.index(d2["id"]) < ids.index(d1["id"]), f"Expected newest-first ordering, got {ids}"
        # Texts preserved
        for t in items:
            if t["id"] == d1["id"]:
                assert t["text"] == "remember dentist"
            if t["id"] == d2["id"]:
                assert t["text"] == "call mom"

    def test_create_thought_empty_text_returns_400(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": ""},
            headers=auth_headers,
        )
        assert r.status_code == 400, r.text

    def test_create_thought_whitespace_text_returns_400(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": "   \t  \n  "},
            headers=auth_headers,
        )
        assert r.status_code == 400, r.text

    def test_delete_thought_removes_it(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": "TEST_to delete"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        tid = r.json()["id"]

        rd = requests.delete(
            _url(base_url, f"/api/thoughts/{tid}"), headers=auth_headers
        )
        assert rd.status_code == 200, rd.text

        # Verify gone
        rl = requests.get(_url(base_url, "/api/thoughts"), headers=auth_headers)
        assert tid not in [t["id"] for t in rl.json()]

    def test_delete_nonexistent_thought_returns_404(self, auth_headers, base_url):
        rd = requests.delete(
            _url(base_url, "/api/thoughts/thought_doesnotexist123"),
            headers=auth_headers,
        )
        assert rd.status_code == 404, rd.text

    def test_convert_thought_creates_task_and_archives(self, auth_headers, base_url):
        # Create thought
        r = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": "buy groceries"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        tid = r.json()["id"]

        target_date = "2026-04-20"
        # Convert
        rc = requests.post(
            _url(base_url, f"/api/thoughts/{tid}/convert"),
            params={"date": target_date},
            headers=auth_headers,
        )
        assert rc.status_code == 200, rc.text
        task = rc.json()
        assert task["title"] == "buy groceries"
        assert task["recurring"] is False
        assert task["date"] == target_date
        assert task["completed"] is False
        task_id = task["id"]
        assert task_id.startswith("task_")

        # Thought no longer returned by GET /thoughts (archived)
        rl = requests.get(_url(base_url, "/api/thoughts"), headers=auth_headers)
        assert tid not in [t["id"] for t in rl.json()]

        # Task visible on that date
        rt = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": target_date},
            headers=auth_headers,
        )
        assert rt.status_code == 200
        task_ids = [t["id"] for t in rt.json()]
        assert task_id in task_ids
        # Title preserved
        matched = next(t for t in rt.json() if t["id"] == task_id)
        assert matched["title"] == "buy groceries"

    def test_thoughts_are_per_user_isolated(
        self, auth_headers, base_url, seeded_user, second_seeded_user
    ):
        """User A cannot see User B's thoughts."""
        _, _ = seeded_user
        _, token_b = second_seeded_user
        headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

        # User A creates a thought
        rA = requests.post(
            _url(base_url, "/api/thoughts"),
            json={"text": "TEST_only_user_A_sees_this"},
            headers=auth_headers,
        )
        assert rA.status_code == 200
        a_thought_id = rA.json()["id"]

        # User B lists thoughts -> must not see A's
        rB = requests.get(_url(base_url, "/api/thoughts"), headers=headers_b)
        assert rB.status_code == 200
        b_ids = [t["id"] for t in rB.json()]
        assert a_thought_id not in b_ids

        # B cannot delete A's thought (404 because filtered by user_id)
        rdel = requests.delete(
            _url(base_url, f"/api/thoughts/{a_thought_id}"), headers=headers_b
        )
        assert rdel.status_code == 404


# ---------- PATCH /api/tasks/{id} notes field (Iteration 4) ----------
class TestPatchTaskNotes:
    def test_patch_notes_persists_on_list(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_NotesTask", "recurring": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        task_id = r.json()["id"]
        # Initial notes should be None
        assert r.json()["notes"] in (None, "")

        # PATCH notes
        rp = requests.patch(
            _url(base_url, f"/api/tasks/{task_id}"),
            json={"notes": "green bottle"},
            headers=auth_headers,
        )
        assert rp.status_code == 200, rp.text

        # Verify via GET tasks list
        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        assert rl.status_code == 200
        t = next(t for t in rl.json() if t["id"] == task_id)
        assert t["notes"] == "green bottle"

    def test_patch_notes_empty_clears(self, auth_headers, base_url):
        # Create with notes
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_ClearNotes", "recurring": True, "notes": "initial"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        task_id = r.json()["id"]
        assert r.json()["notes"] == "initial"

        # Clear via PATCH ""
        rp = requests.patch(
            _url(base_url, f"/api/tasks/{task_id}"),
            json={"notes": ""},
            headers=auth_headers,
        )
        assert rp.status_code == 200, rp.text

        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        t = next(t for t in rl.json() if t["id"] == task_id)
        assert t["notes"] == "", f"expected empty string notes, got {t['notes']!r}"

    def test_patch_notes_and_title_together(self, auth_headers, base_url):
        r = requests.post(
            _url(base_url, "/api/tasks"),
            json={"title": "TEST_BothFields", "recurring": True},
            headers=auth_headers,
        )
        task_id = r.json()["id"]

        rp = requests.patch(
            _url(base_url, f"/api/tasks/{task_id}"),
            json={"title": "TEST_BothFields_Renamed", "notes": "remember to bring keys"},
            headers=auth_headers,
        )
        assert rp.status_code == 200

        rl = requests.get(
            _url(base_url, "/api/tasks"),
            params={"date": "2026-02-15"},
            headers=auth_headers,
        )
        t = next(t for t in rl.json() if t["id"] == task_id)
        assert t["title"] == "TEST_BothFields_Renamed"
        assert t["notes"] == "remember to bring keys"
