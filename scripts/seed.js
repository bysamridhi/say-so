// Fills the database with fake participants so you can see what a full Wall looks like.
//   npm run seed                 -> 30 fake participants in the local database (.local-db/)
//   npm run seed -- 60           -> 60 of them
//   npm run seed -- --clear      -> remove every fake participant (real answers are untouched)
// Prints a few codes of fake people who finished all four days: log in with one to jump
// straight to The Wall.
//
// Uses DATABASE_URL if it's set (e.g. in .env.local). Seeding a non-local database such as
// Supabase also needs --allow-remote, and remember to run --clear before the real session.
// Fake participants are always left out of the CSV export.
import { existsSync } from 'node:fs';
import { getDb } from '../lib/db.js';
import { clearSeed, seedDatabase } from '../lib/seed.js';
import { localDbHeldBy } from './dev-server.js';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);
const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a))) || 30;
const clear = args.includes('--clear');

const url = process.env.DATABASE_URL;
if (url) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !args.includes('--allow-remote')) {
    console.error(`DATABASE_URL points at ${host}. Add --allow-remote if you really mean to ${clear ? 'clear fake data there' : 'add fake data there'}.`);
    process.exit(1);
  }
} else {
  const pid = localDbHeldBy();
  if (pid) {
    console.error(`The dev server (pid ${pid}) has the local database open. Stop it first (Ctrl+C), or start it with seed data instead:\n  npm run dev -- --seed`);
    process.exit(1);
  }
}

const db = await getDb();
if (clear) {
  console.log(`Removed ${await clearSeed(db)} fake participants and their answers.`);
} else {
  const finished = await seedDatabase(db, count);
  const [{ total }] = await db.query('select count(*)::int as total from answers');
  console.log(`Added ${count} fake participants (${finished.length} finished all four days). ${total} answers stored in total.`);
  console.log('\nLog in with one of these codes to see The Wall:');
  for (const code of finished.slice(0, 3)) console.log(`  ${code}`);
  console.log('\nRemove the fake data any time with: npm run seed -- --clear');
}
await db.close();
