# Family Hub architecture notes

## Layout

- `frontend/` — React + TypeScript + Vite + Tailwind UI (Supabase Auth client)
- `backend/` — FastAPI API (verifies Supabase JWTs for protected routes)
- `supabase/migrations/` — Postgres schema, RLS, signup trigger

## Auth and data isolation

- Supabase Auth issues JWTs; the frontend holds the session  
- Signup without an invite creates a `groups` row + `invite_code`; signup with a code joins that group  
- Each group member has their own Supabase Auth account; RLS lets all members share the calendar  
- FastAPI `GET /api/me` validates the Bearer token with `SUPABASE_JWT_SECRET`

## Product modules

- **Opportunities** — catalog + per-person `opportunity_tracking` (multi-person ready)  
- **Calendar** — group-shared `calendar_events`  
- **Intake** — `manual` / `url` / `scraper` source types; `scrape_sources` for job health flags  

## Local vs production

Locally: Vite `:5173`, Uvicorn `:8000`, hosted Supabase project.  

Production (same monorepo): static host for `frontend/`, ASGI host for `backend/`, Supabase for DB + Auth.
