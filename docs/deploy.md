# Deploy Family Hub

Target: **Vercel** (frontend) + **Render** (API) + **Supabase** (already running).

## 1. Supabase migrations

In the SQL Editor, ensure these have been applied (in order):

1. `supabase/migrations/20261010000000_auth_and_core.sql`
2. `supabase/migrations/20261012000000_opportunity_opens_at.sql`
3. `supabase/migrations/20261013000000_opportunity_timing_kind.sql`
4. `supabase/migrations/20261015000000_college_targets.sql`
5. `supabase/migrations/20261016000000_college_why.sql`
6. `supabase/migrations/20261017000000_college_deadlines.sql`
7. `supabase/migrations/20261027000000_application_record.sql`
8. `supabase/migrations/20261027000001_calendar_coming_up.sql`

Auth → URL configuration (required for email confirm / password reset):

- **Site URL:** your production Vercel URL (not `http://localhost:3000`)  
  e.g. `https://your-app.vercel.app`
- **Redirect URLs:** add both production and local, e.g.  
  `https://your-app.vercel.app/**`  
  `http://localhost:5173/**`  
  `http://127.0.0.1:5173/**`

If Site URL stays on localhost, confirmation emails will send people there.

## 2. Backend on Render

1. [Render](https://render.com) → New → Blueprint, or Web Service from this repo  
2. Use `render.yaml` (Docker, context `backend/`)  
3. Set env vars:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret |
| `SUPABASE_ANON_KEY` | anon public key |
| `CORS_ORIGINS` | `https://YOUR_APP.vercel.app` (plain URL; comma-separate if several) |
| `OPENAI_API_KEY` | optional — URL extract + college Find link |
| `OPENAI_MODEL` | `gpt-5-nano` (page extract) |
| `OPENAI_WEB_SEARCH_MODEL` | `gpt-5-nano` (Responses API web search; optional override) |

4. Note the API URL, e.g. `https://family-hub-api.onrender.com`

## 3. Frontend on Vercel

1. [Vercel](https://vercel.com) → Import the GitHub repo  
2. **Root Directory:** `frontend`  
3. Framework: Vite (auto)  
4. Env vars:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | same as Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_API_BASE_URL` | Render API URL (no trailing slash) |

5. Deploy → copy the Vercel URL  
6. Update Render `CORS_ORIGINS` to that URL and redeploy the API if needed

## 4. Smoke check

- `https://YOUR_API/api/health` → `{"status":"ok",...}`  
- Open the Vercel site → sign up / sign in  
- Add an opportunity (paste URL or manual)  

**Scan sources** only appears in local `npm run dev`, not in production builds.
