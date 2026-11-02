# "Say So" — Live Cultural Probe: Handoff Document

**Purpose of this file:** context for an AI coding assistant (e.g. Claude Code) to help port this project from a claude.ai Artifact prototype to a self-hosted version on Vercel, using Supabase as the live/shared database. Read this fully before touching code — the "why" matters as much as the "what" here, since several design choices were made deliberately after hitting real bugs, and re-introducing those same bugs in the Supabase port would be an easy trap.

The companion file `say-so-current-artifact.html` is the exact, current, working prototype. It is a single self-contained HTML file (inline CSS + JS, no build step) that currently depends on a claude.ai-only API (`window.claude.use('db')`) for its live shared-data features. That dependency is the *only* thing that needs replacing — everything else (markup, styling, UX flow, question content) should carry over largely as-is.

---

## 1. What this actually is, and why it exists

This is a class project for a graduate design course (Transformation Design B, "Cultural Probe" assignment). A cultural probe is a design-research method (see Gaver, Dunne & Pacenti, "Cultural Probes," *interactions*, 1999) where you give participants small, open-ended prompts — not a survey — to surface "fragmentary, inspirational" material about their lives, rather than clean, generalizable data.

The student's probe, **"Everyday Sayings,"** investigates unspoken rules that govern how women are expected to look, sound, and behave within Indian families — things like why a tattoo or piercing on a woman gets read as a character flaw, who is understood to have "decided" these rules, and the gap between how women are symbolically honored (e.g. as goddesses) and how they're actually treated day to day. This grew out of a semester of interviews, personal freewriting, and design experiments (posters, a mock legal "lease agreement" dramatizing marriage as a property transfer, a mock government rejection letter, etc.) — the probe is one piece of a much larger body of work, not a standalone app.

The probe originally ran as **four async Google Forms**, one "day" at a time, meant to be answered alone, over several days, anonymously.

### Why this live version exists
The student's professor reviewed her synthesis of the (small, n=3) Google Forms data and said it looked like she was **"forcing"** conclusions onto thin data. Rather than over-claim from 3 responses, the plan became: run a **live, in-classroom version** of the same probe during a presentation, so a whole class answers together in real time, producing a bigger, fresher dataset that's harder to dismiss as cherry-picked, and that can be shown "unlocking" live as a dramatic moment in the presentation itself.

That's why this needs to be **genuinely live and shared** — not just a form that emails her results. Everyone in the room should see everyone else's answers accumulate in real time, which is the whole point.

---

## 2. The probe content (do not change without asking)

Four "days," 26 prompts total, carried over exactly from the original four Google Forms:

- **Day 1 — "Finish the Sentence"** (10 prompts): half-sentences like *"A good girl never ___"*, *"A girl who talks back ___"*, plus a couple of meta-questions ("who usually says lines like these," "if these sentences had a sound...").
- **Day 2 — "Who's in Your Head"** (4 prompts): about the imagined person/crowd someone pictures judging them before they act.
- **Day 3 — "The Route of a Rule"** (6 prompts): trace one rule back to its origin, what it costs, what it protects.
- **Day 4 — "A Rule That Bent"** (6 prompts): a rule that loosened over time, and whether "patriarchy" feels like the right word for it.

Exact wording lives in the `DAYS` array near the top of the `<script>` in the HTML file — treat that as the source of truth.

---

## 3. UX decisions already made (and why) — please preserve these

- **One "Submit Day X" button per day, not per-question.** Earlier version had a Save button on every single question; the student asked for this to be removed in favor of one button at the bottom of each day. Fill in what you want, leave the rest blank, hit submit once. Blank questions are recorded as "skipped," not blocking submission.
- **Submitting a day visually locks it**: every answered card gets a pink tint + checkmark badge, inputs disable. This was added because an earlier version's confirmation state was too subtle ("there used to be a way to know if the answer is submitted" — user feedback).
- **Submitting a day auto-advances to the next day's tab.** Explicit user request.
- **A 5th tab, "The Wall,"** stays locked (shown with a lock icon, not clickable) until a participant has submitted all 4 days themselves. Once unlocked, it shows **every** participant's answers, grouped by Day then by Question, live. This gate (finish everything, *then* see results) was an explicit design choice — results are not shown inline next to each question as you answer it ("don't add people's answers on the same question card, create a new tab").
- **Visual identity**: yellow (`#F6C90E`) as the dominant background, black (`#141414`) for nearly all type and the header/tab bar, white cards, and a single hot-pink accent (`#FF4D6D`) reserved *only* for "selected/active/submitted" states. Explicit instruction: "make it fun." Fonts: Archivo Black (display) + Space Grotesk (body), both via Google Fonts.
- **A "Reset my answers" button** exists in the header. This clears only the *local device's* record of "which days have I personally submitted" (localStorage) — it does **not**, and should never, delete anything from the shared dataset. It exists because repeated testing on the same browser left stale "already submitted" state that made the UI look broken (every day showed an "ALL DONE" banner instead of a submit button, with nothing to click) — this is a UX safety valve, not a data-management feature, and participants should never be able to delete real submitted data.
- **No participant identity is ever collected.** No names, no accounts tied to a person. Fully anonymous by design — this is core to the research ethics of the probe, not incidental.

---

## 4. Bugs we hit in the claude.ai version — read this before writing Supabase code

These are worth understanding even though the specific API is being replaced, because the *shape* of each bug could easily resurface in a new implementation if the same assumptions get made again.

1. **Path/collection-path mix-up.** The first working attempt stored each question's answers in its own "collection," keyed like `answers/{promptId}`. The claude.ai database enforces strict even/odd path-segment rules (odd = collection, even = document) and this 2-segment path was actually a *document* reference, not a collection — every write silently threw. **Fix:** one flat table/collection called `answers`, with a `prompt_id` column/field on each row, queried with a `WHERE prompt_id = ...` filter rather than a different table per question.
   → **For Supabase:** use exactly this shape. One `answers` table, not 26 tables. Columns roughly: `id uuid primary key default gen_random_uuid()`, `prompt_id text not null`, `text text not null`, `is_chip boolean default false`, `created_at timestamptz default now()`.

2. **Subscribing inside a render function.** Live-update listeners were originally set up inside the function that renders "The Wall" tab — which can run more than once (e.g. if that render function gets triggered twice in quick succession). The claude.ai DB docs explicitly warn against this ("subscribe once per query, never in render"), and ignoring it caused a real bug: a second render would rebuild the DOM, but old listeners stayed bound to now-detached elements, so the *new*, visible elements never got updated again.
   → **Fix used:** subscribe exactly once, globally, as soon as the database connection is ready (not tied to which tab is showing). Cache incoming data in a plain JS object (`wallData`). Render functions just read from that cache and paint whatever elements currently exist; they never subscribe anything themselves.
   → **For Supabase:** set up the realtime subscription(s) once, on app load (e.g. one `supabase.channel('answers-changes').on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'answers'}, handleNewRow).subscribe()`), store results in that same kind of cache, and keep rendering strictly separate from subscribing.

3. **DOM-ordering bug (the sneaky one).** "The Wall" rendering built each day's section as an in-memory DOM fragment, and tried to paint live data into elements *before* that fragment was attached to the real page. `document.getElementById(...)` can't find elements that aren't attached to the live document yet, so every paint attempt silently found nothing — even though the underlying data was completely correct the whole time. This produced a very confusing symptom (data clearly exists, UI shows nothing) that took a long debugging session to isolate.
   → **Lesson for the port:** always fully build and attach a section to the live DOM first, *then* run a separate pass to populate it with cached/live data. Don't interleave "create element" and "look it up by ID to paint it" in the same loop.

4. **Stale local state looking like a broken app.** Testing repeatedly in the same browser meant `localStorage` already had every day marked "submitted" from a previous test run, so the submit buttons had been correctly replaced by "already done" banners — but this looked, to the student, exactly like broken/unresponsive buttons. Hence the Reset button described above. Worth keeping some equivalent in the ported version, and maybe worth adding a small on-screen diagnostic note like *"you've already submitted Day 2 on this device"* so it's self-explanatory next time, rather than looking like a dead button.

5. **No devtools access while testing on a phone.** A lot of debugging time went into this because the student was testing live on her phone with no way to see console errors. We ended up building a small always-visible diagnostics readout in the header (connection status, write permission, per-write success/failure with the real error text) specifically so she could screenshot it and report back exact errors instead of just "it's not working." **Strongly recommend keeping something equivalent** in the Supabase version — e.g., a small debug panel (removable before the real presentation) that shows connection status and the result of the most recent write/read, since she'll likely be testing primarily from her phone again.

---

## 5. What needs to actually change (the porting work)

Everywhere the current HTML calls `window.claude.use('db')` / `db.collection(...)` / `.where(...)` / `.onSnapshot(...)` / `.add(...)`, that needs to become Supabase JS client calls instead. Rough mapping:

| claude.ai Artifact DB | Supabase equivalent |
|---|---|
| `window.claude.use('db')` → `db` | `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` |
| `db.collection('answers')` | `supabase.from('answers')` |
| `.add({...})` | `.insert({...})` |
| `.where('promptId','==',id).onSnapshot(cb)` | initial `.select('*').eq('prompt_id', id)` + a realtime channel subscription filtered or filtered client-side on `prompt_id` |
| live "count all docs" listener | either a realtime subscription on the whole table, or periodic `.select('*', {count:'exact', head:true})` |

### Auth / write access
The claude.ai version required the viewer to be signed in with write permission (`user.can('data.write')`). A public Vercel-hosted page won't have that — **this needs a deliberate decision, not a default.** Recommend:
- No login required for participants (keep it frictionless and anonymous, matching the original probe's ethics).
- Use Supabase **Row Level Security** on the `answers` table: allow `INSERT` and `SELECT` from the anon/public role, but **not** `UPDATE` or `DELETE`. This keeps it open enough to use instantly while still preventing someone from editing or wiping other people's answers.
- Consider very basic abuse protection (e.g. a simple client-side rate limit, or a Supabase Edge Function in front of inserts) since this will be a fully public, unauthenticated write endpoint for the class session. Doesn't need to be bulletproof — just not wide open to spam from a shared link.

### Hosting shape
The current file is a single, dependency-free HTML file (fonts via Google Fonts `<link>`, everything else inline). Simplest path: keep it that way, add one `<script src="https://cdn.jsdelivr.net/.../@supabase/supabase-js">` (or import via a tiny Vite setup if preferred) and deploy as a static site on Vercel. No need to introduce a framework unless it genuinely helps — don't over-engineer this.

---

## 6. Open items / next steps

- [ ] Create a free Supabase project; create the `answers` table as described above.
- [ ] Enable Realtime on that table (Database → Replication, or via the table's realtime toggle).
- [ ] Set RLS policies: public insert + select, no update/delete, on `answers`.
- [ ] Swap every claude.ai DB call in `say-so-current-artifact.html` for the Supabase equivalent, following the bug-avoidance notes in section 4 (one flat table, subscribe once globally, attach-then-paint ordering).
- [ ] Keep (or re-build) the "Reset my answers" button and the diagnostics readout — both solved real problems during testing, not cosmetic extras.
- [ ] Deploy to Vercel; get a public URL.
- [ ] Test the *actual* live-sync behavior across at least two real devices before the real class session — this was never fully verified by an AI assistant in the claude.ai version, since local tooling could only simulate the database, not really prove multi-device sync. Don't skip this.
- [ ] Decide what happens to the data after class (export for her thesis synthesis? Where does it live? She'll want to pull these responses back out afterward to analyze.)

---

## 7. One framing note, for whoever picks this up

The live probe is instrumental to a much bigger, personal, and carefully-built thesis project — not a generic app. Many small decisions here (anonymity, the results-gate on "The Wall," the tone of the copy, the color choice) were made deliberately and discussed at length. When in doubt about a UX or copy choice while porting, preserve what's there rather than "improving" it — the priority right now is reliable self-hosting, not a redesign.
