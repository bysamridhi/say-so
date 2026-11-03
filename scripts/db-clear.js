// Deletes EVERY participant and answer, real and fake, so you can start from an empty Wall.
//   npm run db:clear            -> asks you to type DELETE first
//   npm run db:clear -- --yes   -> no question (for when you're sure)
// Uses DATABASE_URL from .env.local (your Supabase project) if set, otherwise the local database.
// Phones that still have an old code are sent back to the START screen automatically.
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { getDb } from '../lib/db.js';
import { localDbHeldBy } from './dev-server.js';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);
const url = process.env.DATABASE_URL;
if (!url) {
  const pid = localDbHeldBy();
  if (pid) {
    console.error(`The dev server (pid ${pid}) has the local database open. Stop it first (Ctrl+C).`);
    process.exit(1);
  }
}

const db = await getDb();
const where = url ? `${new URL(url).hostname} (LIVE data)` : `the local database (${process.env.LOCAL_DB_DIR || '.local-db/'})`;
const [counts] = await db.query(
  `select (select count(*)::int from participants) as people,
          (select count(*)::int from participants where is_seed) as fake,
          (select count(*)::int from answers) as answers`,
);
console.log(`\n${where}\n  ${counts.people} participants (${counts.fake} fake), ${counts.answers} answers\n`);

if (!counts.people) {
  console.log('Already empty. Nothing to do.');
} else {
  let ok = process.argv.includes('--yes');
  if (!ok) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    ok = (await rl.question('This permanently deletes all of them. Type DELETE to continue: ')).trim() === 'DELETE';
    rl.close();
  }
  if (ok) {
    await db.query('truncate answers, day_submissions, participants');
    console.log('Done. The Wall is empty.');
  } else {
    console.log('Cancelled. Nothing was deleted.');
  }
}
await db.close();
