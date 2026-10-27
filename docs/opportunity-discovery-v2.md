# Opportunity discovery v2 — planning notes

**Status:** brainstorm / not scheduled  
**Context:** Opportunities v1 works well (paste URL → extract, curated Scan in DEV, group-scoped list). Goal: make *finding* new programs more dynamic without turning Family Hub into a noisy feed.

---

## 1. What v1 already does

| Path | Who | How |
| --- | --- | --- |
| Paste URL + Pull details | Any signed-in member | Fetch page → LLM/rules extract → review → save |
| Scan sources | Local DEV only | Fixed curated list in `backend/app/data/curated_sources.py` → propose → review → save |
| Manual add | Any member | Hand-enter fields |

**Gaps for “dynamic discovery”**

- Curated list is static and code-owned  
- Scan is not available in production  
- No scheduled refresh / “what’s new”  
- No search-by-topic (“Chicago teen STEM summer”)  
- No alerts when a known source posts a new deadline  

---

## 2. Goals (draft)

1. **Surface new programs** with less manual hunting  
2. Keep **human review** before anything hits the family list (no silent auto-save)  
3. Stay **Chicago / teen / STEM-leaning** by default (or group preferences later)  
4. Control **cost** (OpenAI web search ~$0.01/search + extract tokens)  
5. Respect **group privacy** — discovery proposals can be shared templates; saved rows stay per-group  

Non-goals for early v2:

- Public marketplace of all Chicago teens  
- Fully autonomous scraping of the whole web  
- Replacing paste-URL for one-off finds  

---

## 3. Discovery models (options)

### A. Managed source library + scheduled scan (recommended backbone)

- Move curated sources from code → DB (`scrape_sources` already exists in schema)  
- Admin / owner can add, pause, or tag sources  
- Cron (Render / Supabase) runs scan on a cadence (e.g. weekly)  
- Results land in a **Proposals** inbox: accept → opportunity, dismiss → ignore  

**Pros:** Predictable, high precision, cheap, matches v1 Scan  
**Cons:** Still depends on maintaining good source URLs  

### B. Search-assisted discovery (OpenAI web_search or CSE)

- Query templates: e.g. `Chicago high school summer STEM internship 2026 applications`  
- Model returns candidate pages → same extract pipeline → proposals  
- Rate-limit: few searches per week per group or shared global  

**Pros:** Finds pages not on the curated list  
**Cons:** Cost, noise, aggregators; needs strong filtering + review UI  

### C. “Watch this page” / change detection

- User pins a listing URL  
- Job re-fetches periodically; if new program cards / dates appear → proposal  

**Pros:** Great for hubs that update yearly (museums, universities)  
**Cons:** Needs durable hashing / diff logic; flaky HTML  

### D. Shared catalog + group import

- Platform-maintained opportunity catalog (not group-owned)  
- Groups **import** items into their tracker  

**Pros:** One discovery engine, many families  
**Cons:** Product + moderation scope; bigger than Family Hub v1  

### E. Hybrid (suggested direction)

1. **Phase 2a:** DB-backed sources + production Scan / weekly job + Proposals inbox  
2. **Phase 2b:** Optional “Find more” using web_search with strict prompt + domain allow/deny  
3. **Phase 2c:** Watch-listed sources for change detection  
4. Later: shared catalog only if multiple families need the product  

---

## 4. Product surfaces

| Surface | Purpose |
| --- | --- |
| **Discover / Inbox** | Review AI or scan proposals before save |
| **Sources** | Manage watched / curated URLs (owner/parent) |
| **Find more** | One-shot search query → proposals (opt-in, cost-aware) |
| Opportunities list | Unchanged as source of truth for *tracked* items |

Keep Opportunities as the tracker; discovery is an upstream funnel.

---

## 5. Technical sketch

```
Sources (DB) ──cron──► fetch + extract ──► proposals (group or global)
                              ▲
User "Find more" ──web_search─�──► proposals (group or global)
                              ▲
User "Find more" ──web_search─┘
                              │
                    review UI │
                              ▼
                     opportunities (group)
```

Reuse:

- `extract_from_url` / `llm_extract`  
- College `web_search` patterns (cite → prefer .edu / org, reject aggregators)  
- Existing `scrape_sources` table if it fits; otherwise thin `discovery_sources` + `discovery_proposals`  

Open design choices:

- Proposals **per group** vs **global** then import  
- Dedupe key: URL + title + year?  
- Who can run Find more / manage sources (owner/parent only?)  

---

## 6. Trust, safety, cost

- Never auto-insert into `opportunities` without review  
- Cap web_search (e.g. N/week) and show when a search will spend credits  
- Prefer official .edu / museum / city domains; downrank Niche/Reddit-style pages  
- Store `last_scanned_at`, `last_error` on sources for debugging  
- Log proposal provenance: `source_id` | `web_search` | `manual_url`  

---

## 7. Phased plan (proposal)

### Phase 2a — Production Scan + inbox (smallest dynamic win)

- [ ] Promote curated sources into DB (seed from `curated_sources.py`)  
- [ ] Enable Scan (or “Refresh sources”) in production for owners/parents  
- [ ] Proposals inbox UI (accept / dismiss)  
- [ ] Optional weekly cron on Render  

### Phase 2b — Find more

- [ ] `POST /api/intake/discover` with query or preset chips (“Summer STEM”, “Museum teens”)  
- [ ] OpenAI web_search → candidate URLs → extract → proposals  
- [ ] Hard caps + clear copy on cost  

### Phase 2c — Watch + notify

- [ ] Per-source schedule + change detection  
- [ ] Dashboard badge: “3 new proposals”  
- [ ] Optional email/digest later  

---

## 8. Open questions for us

1. Is discovery **family-private** (each group scans for itself) or **shared** (we maintain one catalog)?  
2. OK to spend ~$0.01–0.05 per “Find more” run?  
3. Should teens be able to run discovery, or only parents/owners?  
4. Priority: **scheduled Scan** vs **search Find more** first?  
5. Do we want deadlines from discovery to also land on **Coming up / Calendar** automatically on accept?  

---

## 9. Decision log

| Date | Decision |
| --- | --- |
| 2026-10-14 | Doc opened; v1 tracker stays; discovery is a separate funnel with review |
| 2026-10-14 | **Build Phase 2a first.** Keep current Opportunities v1 fully in place (paste URL, list, filters, tracking). 2a is additive. |
| 2026-10-14 | 2a shape: DB-backed sources + production Scan/Refresh + Proposals inbox (accept → existing opportunity create path; dismiss → ignore). No silent auto-save. |
| 2026-10-14 | **Find more POC** (DEV only): `POST /api/intake/discover-poc` + Opportunities panel. Web search → ≤4 extracts → **display only** (no DB write). |

---

## 10. Coexistence: v1 stays, 2a layers on

Do **not** replace or rewrite the Opportunities tracker. Ship discovery beside it.

| Stays as-is (v1) | New (2a) |
| --- | --- |
| Opportunities list, filters, sort, status | **Discover / Proposals** inbox (or panel on Opportunities) |
| Paste URL → Pull details → save | **Sources** (seeded from `curated_sources.py` into DB) |
| Manual add / edit / delete | **Scan / Refresh sources** enabled in production (not DEV-only) |
| Group-scoped `opportunities` rows | `discovery_proposals` (or reuse scan proposals) → Accept calls existing create API |

```
[v1 tracker]          Opportunities list ←── Accept ──┐
[v1 intake]           Paste URL / manual add            │
[2a discovery]        Sources → Scan → Proposals ───────┘
```

**Code boundaries**

- Keep `curated_sources.py` as seed data for migration; runtime reads DB  
- Keep `/api/intake/extract` and OpportunityForm for paste-URL  
- Extend or add `/api/intake/scan` for production + authz (owner/parent)  
- New tables (or extend `scrape_sources`): sources + proposals; **no change** to opportunity row shape required for MVP  
- Frontend: v1 page remains; add Discover entry (tab, section, or route) without removing Add opportunity  

**Rollout**

1. Schema + seed sources (feature works even if UI is partial)  
2. Scan → proposals API  
3. Inbox UI (Accept / Dismiss)  
4. Optional weekly cron later — button-triggered Scan is enough for first ship  

---

## 11. Next step

Implement Phase 2a as an additive slice. Still open from §8 if useful before coding: proposals per-group vs shared; who can Scan (owner/parent vs all members). Defaults if unspecified: **per-group proposals**, **owner/parent can Scan**.
