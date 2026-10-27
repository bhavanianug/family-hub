# Ideas & potential features

Living backlog for Family Hub. Grouped by category; prioritize **within** each category. Deep plans go in `docs/<feature>.md`.

**Status:** `idea` · `maybe` · `next` · `done` · `wont`  
**Priority:** `must` · `should` · `could` · `later`

**North star:** Parents and kids are the consumers. Start discovery with **teens**. Orgs may post later — don’t block family value on that.

---

## How to read this

| Category | Job | Competing for “next”? |
| --- | --- | --- |
| **Core product** | Weekly family value (tracker, roles) | Yes — product roadmap |
| **Discovery** | Find programs (filters, AI, auto) | Yes — product roadmap |
| **Trust & safety** | Security layers L1–L6 | No — floor for every release |
| **Growth** | Orgs, shared catalog | Yes — only after core + discover feel good |
| **Other modules** | College, calendar, polish | Separate lanes |

Don’t rank “security” against “org posting” on one flat list.

---

## 1. Core product

*Tracker and who uses it. Priority within this category.*

| Priority | Status | Idea | Notes |
| --- | --- | --- | --- |
| must | done-ish | Opportunities tracker (v1) | Paste URL, manual add, status, deadlines — keep solid |
| should | idea | Parents + kids as consumers | Same data, different jobs (see notes) |
| could | idea | Kid-friendly vs parent-admin surfaces | Teen “For you”; parent approve / AI spend |
| could | idea | Notifications | Parent: new proposals; teen: saved program |

### Notes — parents + kids

| Role | Job | Discovery |
| --- | --- | --- |
| Parent | Trust, approve, deadlines, AI cost | Full Discover + accept/dismiss |
| Kid / teen | Browse, interest, status | Softer list; limited or no spendy search |

Open questions: teen can run Find more, or only “ask parent”? One login per person (leaning yes).

---

## 2. Discovery

*Upstream funnel into the tracker. Human review before save. See also [opportunity-discovery-v2.md](./opportunity-discovery-v2.md).*

| Priority | Status | Idea | Notes |
| --- | --- | --- | --- |
| should | next | Generative AI text discovery (Find more POC) | Own nav page; OpenAI web_search; display-only |
| should | next | Filter-driven discovery | Chips → query builder; steers OpenAI + Perplexity |
| could | idea | Auto-discovery (teens first) | Scheduled sources + filtered search → proposals inbox |
| could | idea | Search provider swap | SerpAPI / Brave / Perplexity Search; LLM for rank/extract |
| later | maybe | Shared catalog import | Multi-family; bigger than one hub |

### Suggested order inside Discovery

1. Find more POC (text AI) — learning what quality looks like  
2. Filters → constrained search / pre-filled query  
3. Auto proposals inbox (sources + scheduled filtered search)  

### Notes — auto-discovery (teens first)

- **A.** Scheduled pull of known sources → inbox  
- **B.** Scheduled search from filters → inbox  
- **C.** On-open refresh when opening Discover  
- Start with high school; middle school is a separate Who chip  
- Auto = *find*, not *add to tracker*

### Filters (settled for v1) — how they work

Not a chat. Chips on Find more build one search ask, then the existing OpenAI / Perplexity / Both path runs.

| Filter | UI | Default | Becomes in the query |
| --- | --- | --- | --- |
| **Who** | High school · Middle school | High school | `high school` or `middle school` (plus “teen” as helper text) |
| **Where** | Text box (US only note) | Chicago | typed place; blank → Chicago |
| **Interest** | Dropdown (fixed list), pick one | none (required) | selected label / keywords |
| **When / type** | Summer · Ongoing · Volunteer · Internship / research | none (pick one) | that word |
| **Orgs** | Optional tags | empty | org names appended |
| **Other** | Optional short text | empty | appended if interest needs a one-off |

**Fixed interests:** STEM · Architecture / design · Physics / space · Math · Nature / outdoors · Museum / culture · Research / lab · Volunteering / service · Arts

**Flow**

1. Parent picks Who + Where + Interest + When.  
2. App builds a query string, e.g. `Chicago high school architecture summer official program`.  
3. Same string goes to OpenAI (with the tightened prompt) and/or Perplexity (query + deny-list).  
4. Results merge into one list; **Add to Opportunities** runs the same extract as Pull details, then saves.  
5. Opportunities remains the tracker for status and follow-up.  

No free-form chat thread. Optional Other / Orgs only when chips are not enough.

**Mesh with Opportunities:** Discover = funnel. Opportunities = tracker. Add to Opportunities crosses the gap; nothing auto-saves.

### Notes — text AI discovery

- Filters pre-fill the query; Other can edit the edge case  
- Guardrails: max length, locale default, no auto-save, timeout, host deny-list  
- Engines: OpenAI + Perplexity compare tabs today; merge later

---

## 3. Trust & safety (cross-cutting)

*Not a roadmap bet that competes with features. Apply on every release. Principle: **untrusted discover → review inbox → trusted tracker**.*

| Priority | Layer | Focus |
| --- | --- | --- |
| must | L1 Identity | Auth JWTs, invites, session hygiene; roles in API later |
| must | L2 Data | Group RLS; no cross-family proposals; service role server-only |
| must | L3 AI & discovery | Rate limits, prompt bounds, SSRF, deny-lists, no auto-save |
| should | L4 Family / minors | Parent gate on spendy AI; minimal PII in prompts; age band |
| later | L5 Org / supply | Claim, moderation, trust tiers (with Growth) |
| must | L6 Platform | Secrets, CORS, logging hygiene, edge rate limits |

```
┌─────────────────────────────────────────────────────────┐
│ L1  Identity & access  auth, sessions, invite codes     │
├─────────────────────────────────────────────────────────┤
│ L2  Data isolation     group RLS, no cross-family leak  │
├─────────────────────────────────────────────────────────┤
│ L3  AI & discovery     prompts, cost, SSRF, junk        │
├─────────────────────────────────────────────────────────┤
│ L4  Family & minors    roles, consent, kid-safe UX      │
├─────────────────────────────────────────────────────────┤
│ L5  Org / supply       claim, moderation, spam          │
├─────────────────────────────────────────────────────────┤
│ L6  Platform & ops     keys, logs, deps, abuse at edge  │
└─────────────────────────────────────────────────────────┘
```

### L3 risks (discovery-specific)

| Risk | Control |
| --- | --- |
| Prompt injection (Find more) | Max length; prefer filters; fixed system prompt |
| Cost abuse / bots | Auth; per-user + per-group limits; parent-only spendy search |
| SSRF (paste URL / extract) | http(s) only; block private IPs; timeouts; size caps |
| Scam / junk pages | Deny-list; prefer .edu/.gov; human review |
| Model exfil | Prompt = query + page snippets only, not full family DB |

Filters are a **security control**, not only UX.

### L1 / L2 / L4 / L5 / L6 (short)

- **L1:** Invite hygiene; `parent` / `teen` / `org_admin` enforced server-side when roles exist  
- **L2:** Proposals + preferences per group; explicit export/share  
- **L4:** Teens on app → no address/school ID in prompts; proposals ≠ endorsements  
- **L5:** Domain claim, mod queue, `org_posted` vs `family_discovered` vs `curated`  
- **L6:** No secrets in client; no tokens/PII in logs  

---

## 4. Growth / marketplace

*Second product. Only after one family loves core + discover.*

| Priority | Status | Idea | Notes |
| --- | --- | --- | --- |
| later | maybe | Orgs can post opportunities | Claim domain, moderation, spam controls (L5) |
| later | maybe | Shared platform catalog | Groups import into their tracker |

| | Family-sourced discover | Org-posted |
| --- | --- | --- |
| Trust | Official pages you choose | Verify / claim / moderate |
| Spam | Low (review inbox) | High without gates |
| Cold start | Web search alone works | Needs orgs |

Schema can reserve `source_type = org_post` early without building the portal.

---

## 5. Other modules

### College

| Priority | Status | Idea | Notes |
| --- | --- | --- | --- |
| — | idea | … | |

### Calendar / group

| Priority | Status | Idea | Notes |
| --- | --- | --- | --- |
| — | idea | … | |

### Platform polish

| Priority | Status | Idea | Notes |
| --- | --- | --- | --- |
| — | idea | … | |

---

## Release phasing (by category)

| When | Core | Discovery | Trust & safety | Growth |
| --- | --- | --- | --- | --- |
| **Now** | Keep tracker solid | Find more POC | L1/L2/L6 floor + L3 basics | — |
| **Next** | — | Filters → constrained search | Tighten L3 rate limits | — |
| **Then** | Soft parent/teen UX | Auto proposals inbox | L4 parent gate on AI | — |
| **Later** | — | Provider swap if needed | L5 with org tools | Org post + catalog |

---

## Scratch

Freeform — promote into a category table when ready.

-
