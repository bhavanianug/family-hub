# Supabase database and auth setup

## 1. Create a project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → choose org, name (e.g. `family-hub`), password, region
3. Wait until the project is ready

## 2. Apply the migration

In the Supabase dashboard: **SQL Editor** → New query → paste the contents of:

`supabase/migrations/20261010000000_auth_and_core.sql`

Run it. This creates profiles, groups, people, calendar/opportunities tables, RLS, and a signup trigger.

Or, with the Supabase CLI linked to your project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 3. Auth settings

**Authentication → Providers → Email:** enable Email.

**Authentication → URL Configuration:**

| Field | Value |
| --- | --- |
| Site URL | Production app URL (e.g. `https://your-app.vercel.app`) — **not** `http://localhost:3000` |
| Redirect URLs | `https://your-app.vercel.app/**`, `http://localhost:5173/**`, `http://127.0.0.1:5173/**` |

Confirmation links use Site URL unless signup passes `emailRedirectTo` (the app now sends the current origin). The redirect must still be allow-listed above.

For local testing, you can disable **Confirm email** under Auth settings so sign-up logs you in immediately. Re-enable confirmation before sharing the app widely.

## 4. Copy keys into env files

**Project Settings → API:**

| Value | Put in |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL`, `SUPABASE_URL` |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` |

**Project Settings → API → JWT Settings** (or Legacy JWT secret):

| Value | Put in |
| --- | --- |
| JWT Secret (Legacy) | `SUPABASE_JWT_SECRET` in `backend/.env` — long string, **not** the project UUID/ref |

The backend can also validate sessions via `SUPABASE_URL` + `SUPABASE_ANON_KEY` (preferred). If **Pull details** returns “Invalid or expired token”, your JWT secret is probably wrong; fix the anon key/URL pair or paste the real legacy JWT secret.

```bash
cp frontend/.env.example frontend/.env
cp .env.example backend/.env
# edit both files with real values
```

Never commit `.env` or the service role key.

## 5. What signup creates

**New group (no invite code):**

1. `profiles` row  
2. `groups` row with an `invite_code`  
3. `group_members` as `owner`  
4. Default `people` row (teen, Chicago) for opportunity tracking  

**Join existing group (invite code on signup):**

1. `profiles` row  
2. Joins that group as `member` (not a new group)  
3. `people` row in that group (parent by default)  

Anyone in the group can view/add **shared calendar** events (RLS). Share the invite code from the in-app **Group** section so multiple people can each create their own login.

Existing solo accounts can also use **Join** with a code (replaces their empty solo group).

## 6. Verify

1. Start frontend and backend  
2. Sign up at http://localhost:5173  
3. Confirm you land on the Family Hub shell and can sign out  
4. In Supabase **Table Editor**, check `profiles`, `groups`, `group_members`, `people`
