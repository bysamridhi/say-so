# Say So — a live cultural probe

**Everyday Sayings**, answered together in the room. Four "days" of prompts; everyone's answers
gather on **The Wall**, which unlocks once you've submitted all four days.

Background, design decisions and the bugs the prototype ran into are in
[`docs/say-so-handoff.md`](docs/say-so-handoff.md). The original claude.ai prototype is kept at
[`docs/say-so-current-artifact.html`](docs/say-so-current-artifact.html).

## How it's built

```
public/index.html     the page (same design as the prototype, no build step)
public/prompts.js     the 26 prompts — single source of truth for the page AND the server
api/*.js              Vercel serverless functions (one file = one /api/<name> route)
lib/                  shared server code (database, codes, validation)
supabase/migrations/  the database schema (run once on Supabase)
scripts/dev-server.js local server that runs the same api/*.js files
test/api.test.js      end-to-end test with several participants
```

- **Hosting:** Vercel (free Hobby plan) serves `public/` as static files and `api/` as functions.
- **Database:** Supabase Postgres (free plan). Only the server talks to it; the browser never gets
  a database key. Row Level Security is on with no policies, so Supabase's public API can't read or
  write anything even with the project's anon key.
- **Live updates:** the page asks `/api/wall` every 3 seconds (paused when the tab is in the
  background). If nothing changed, the reply is tiny. One poll loop for the whole page, started once
  at load, never from a render function.

### "Login" = a random return code

No accounts, names or emails. Tapping **START** creates an anonymous participant and shows a
code like `MANGO-RIVER-4821`. The code is kept on that device, so coming back later just works. To
change answers from another phone (or after logging out), enter the code under **"Already answered?
Log back in"**. Typing is forgiving: `mango river 4821` works too.

- The code only unlocks that person's own answers: view them, edit them, clear one to take it back.
- Only a hash of the code is stored. Nothing connects a code to a person.
- The Wall never shows which answers came from the same person.
- Wrong-code guesses are rate-limited.

## Run it locally

Needs Node 20 or newer (`nvm use` picks the version in `.nvmrc`).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. No database setup needed: without `DATABASE_URL`, the dev server runs
a real Postgres inside Node ([PGlite](https://pglite.dev)) and stores it in `.local-db/`. It runs the
same schema file as Supabase.

### Testing with several participants

Each browser storage gets its own participant, so any of these works:

- **http://localhost:3000** and **http://127.0.0.1:3000** in the same browser are two participants.
- A private/incognito window, or a second browser, is another one.
- **Phone:** the dev server also prints a "Phone (same Wi-Fi)" address. Open it on a phone on the
  same Wi-Fi.
- **Switch accounts in one window:** **LOG OUT** in the header, then **START** for a new
  participant, or log back in with an earlier code.
- **Fill the wall with fake people:** with `npm run dev` running, `npm run seed` (or
  `npm run seed -- 25`) creates fake participants and prints their codes so you can log in as any of
  them.

Download everything you've stored: http://localhost:3000/api/export?key=dev.
Start over with an empty local database: stop the server, then `npm run db:reset-local`.

### Automated test

```bash
npm test
```

The test simulates several participants against a fresh in-memory database. It checks that answers
stay separate, that a code can only edit its own answers, that edits and cleared answers show up
correctly on The Wall, that the Wall stays locked until all 4 days are submitted, and that bad input
is rejected.

## Deploy (Supabase + Vercel, both free)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). Choose the region **East US (North
   Virginia)**, which is close to Vercel's default function region. Save the database password.
2. Create the tables. Use either option:
   - **SQL Editor → New query**: paste [`supabase/migrations/20261102000000_init.sql`](supabase/migrations/20261102000000_init.sql) and **Run**.
   - Or locally: put `DATABASE_URL` in `.env.local` (see step 3) and run `npm run db:setup`.
3. Get the connection string: **Connect** (top bar) → **Transaction pooler**. It looks like
   `postgresql://postgres.abcd1234:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`.
   Put your password in place of `[YOUR-PASSWORD]`.

Realtime, Auth and the API keys aren't needed. The app only uses the database.

### 2. Vercel

1. Push this repo to GitHub, then on [vercel.com](https://vercel.com) choose **Add New → Project**
   and import it. Framework preset: **Other**. Leave the build settings as they are.
2. **Settings → Environment Variables:**
   - `DATABASE_URL`: the connection string from Supabase step 3.
   - `EXPORT_KEY`: any long random string. This is the password for the CSV export.
3. Deploy. Open `https://<your-app>.vercel.app/api/health`. It should show `"db":"postgres"`.

### Before the class session

- [ ] **Wake the database.** Free Supabase projects pause after about a week with no activity. Open the
      dashboard a day before and restore the project if it says *Paused*.
- [ ] Test on at least two real phones at the same time, on the deployed URL.
- [ ] **Clear test answers.** In Supabase **SQL Editor**, run
      `truncate answers, day_submissions, participants;`. This permanently deletes everything, so only
      run it before the real session.
- [ ] Hide the diagnostics readout if you want: set `SHOW_DIAGNOSTICS = false` near the top of the
      script in `public/index.html` and push. Adding `?debug=1` to the URL still shows it.

### After the session: getting the data out

Open `https://<your-app>.vercel.app/api/export?key=<EXPORT_KEY>` and a CSV downloads. It has one row
per answer, with the day, the question text and the answer. Participants are numbered `P01`, `P02`…
in join order, so you can read one person's answers together without knowing who they are. The
Supabase **Table Editor** can also export each table as CSV.

## Notes

- Submitting a day saves it to the server. If saving fails, nothing is locked: the answers stay in
  the boxes, the error shows under the button, and you can tap again.
- The prototype's **Reset my answers** button is now **LOG OUT**. Answers live on the server now, so
  old "already submitted" state can't get stuck on a device. Logging out never deletes anything.
- A single-choice chip can be tapped again to un-pick it. That way an edit can clear it.
