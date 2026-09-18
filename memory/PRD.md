# Grounded · Daily — Product Requirements

## Concept
A gentle, ADHD-friendly day planner. Calendar-based task list with **explicit completion** (no swipe / no auto), recurring routines, AI-generated daily joke + interesting fact, and a one-tap **grounding** room with breathing and 5-4-3-2-1 sensory exercises.

## Tech Stack
- Frontend: Expo (React Native + expo-router), TypeScript
- Backend: FastAPI + MongoDB (motor)
- Auth: Emergent-managed Google OAuth (session_token via `expo-secure-store`)
- AI: Claude Sonnet 4.6 via Emergent LLM key (joke + fact, cached per date)

## Core User Flows
1. **Sign in** → "Continue with Google" → Emergent OAuth → returns to app with session_token.
2. **Today** → greeting, progress bar (`X / Y done`), daily joke card, "did you know?" fact, quick links to Plan and Ground.
3. **Plan** → horizontal day-strip (21 days centered on today), per-day list of tasks (recurring + one-time), tap-with-intent checkbox with dopamine bounce animation, FAB → bottom-sheet add-task with `Daily routine` toggle.
4. **Ground** → menu → Box breathing (animated 4-4-4-4 circle) or 5-4-3-2-1 sensory walkthrough.
5. **Me** → avatar, name, email, sign out.

## Backend Endpoints (`/api`)
- `POST /auth/session` — exchange `session_id` → `session_token` + user
- `GET /auth/me` — current user (Bearer)
- `POST /auth/logout` — invalidate session (Bearer)
- `GET /tasks?date=YYYY-MM-DD` — recurring + one-time for date with completion state, sorted by `sort_index`
- `POST /tasks` — create (recurring flag or `date`); auto-assigns next `sort_index`
- `PATCH /tasks/{id}` — update title / notes / date (snooze for one-time)
- `POST /tasks/reorder` — `{items:[{id, sort_index}]}` bulk reorder
- `DELETE /tasks/{id}`
- `POST /tasks/{id}/complete?date=YYYY-MM-DD`
- `POST /tasks/{id}/uncomplete?date=YYYY-MM-DD`
- `GET /streak?date=YYYY-MM-DD` — consecutive completion days ending on date
- `GET /daily-content?date=YYYY-MM-DD` — joke + fact (Claude, cached globally per date)

## MongoDB Collections
- `users` (unique `email`, unique `user_id`)
- `user_sessions` (unique `session_token`, TTL on `expires_at`)
- `tasks` (`user_id`, `recurring`, `date`)
- `completions` (compound unique `user_id`+`task_id`+`date`)
- `daily_content` (unique `date`)

## ADHD-First Design Rules (enforced)
- Calm Organic palette (sage `#6B8E82`, terracotta accent `#E07A5F`, sand `#F9F8F6`)
- 56px touch targets, generous spacing, no red badges, no countdown timers
- Completion requires explicit tap, never swipe or auto
- Grounding overlay is full-screen and removes tab bar distraction
- Daily content is static text — no autoplay, no blinking

## Out-of-scope (MVP)
- Reminders / push notifications
- Multi-day completion history visualization
- Sharing / collaboration
