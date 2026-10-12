# Family Hub

Family organization app: shared calendar + teen opportunity tracker for Chicago high schoolers.

Stack: React + TypeScript + Vite + Tailwind (frontend), FastAPI (backend), Supabase (Postgres + Auth + RLS).

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (3.14 works with the pinned dependencies)
- A free [Supabase](https://supabase.com) project

## Project layout

```
family-hub/
├── frontend/     # Vite + React + TypeScript + Tailwind
├── backend/      # FastAPI + Pydantic + Pytest
├── supabase/     # Migrations + local Supabase config
└── docs/         # Architecture and setup notes
```

## Supabase (database + auth)

Full steps: [docs/supabase-setup.md](docs/supabase-setup.md)

Short version:

1. Create a Supabase project  
2. Run `supabase/migrations/20261010000000_auth_and_core.sql` in the SQL Editor  
3. Copy Project URL, anon key, and JWT secret into env files (below)  
4. For local testing, consider disabling **Confirm email** under Auth settings  

Signup without a code creates a **group** (with an invite code) and a default teen person. Signup **with** an invite code joins that shared group so multiple people can use the same calendar.

## Environment setup

```bash
cp frontend/.env.example frontend/.env
cp .env.example backend/.env
```

Edit both files with your Supabase values:

- `frontend/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- `backend/.env` — `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`
- Optional AI extract / Scan sources: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5-nano`

Never commit `.env` files, the service role key, or OpenAI keys.

Without Supabase keys, the UI shows setup instructions instead of the signed-in app. The API health check still works without them.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health: [http://localhost:8000/api/health](http://localhost:8000/api/health)  
- Authenticated profile: `GET /api/me` with `Authorization: Bearer <supabase_access_token>`

## Frontend

In a **separate terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign up / sign in, then use the shell (Dashboard, Calendar, Opportunities placeholders).

## Tests

```bash
cd backend && source .venv/bin/activate && pytest
cd frontend && npm test
```

## Typecheck and build

```bash
cd frontend
npm run typecheck
npm run build
```

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Setup keys screen instead of app | Fill `VITE_SUPABASE_*` in `frontend/.env` and restart Vite |
| Sign up works but tables empty | Re-run the SQL migration; check SQL Editor for errors |
| Sign up succeeds but can’t sign in | Disable email confirmation for local testing, or confirm the email |
| `GET /api/me` returns 401 | Send a valid Supabase access token; set `SUPABASE_JWT_SECRET` in `backend/.env` |
| Frontend shows **Backend offline** | Start the API on port 8000; check `VITE_API_BASE_URL` |
| CORS errors | Backend allows `http://localhost:5173` by default |

## What’s next

- Shared calendar UI (events + opportunity deadlines)  
- Chicago source scrape jobs with status flags  
- Optional Google Custom Search for discovering local sites  
- Deploy: [docs/deploy.md](docs/deploy.md) (Vercel frontend + Render API + Supabase)
