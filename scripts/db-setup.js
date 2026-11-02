// Creates the tables in the database at DATABASE_URL (your Supabase project).
//   DATABASE_URL="postgresql://…" npm run db:setup      (or put DATABASE_URL in .env.local)
// Safe to run again — the migration only creates what's missing.
import { existsSync } from 'node:fs';
import { getDb, migrate } from '../lib/db.js';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy it from Supabase → Connect → "Transaction pooler" and put it in .env.local.');
  process.exit(1);
}

const db = await getDb();
const files = await migrate((sql) => db.exec(sql));
const [row] = await db.query('select count(*)::int as n from answers');
console.log(`Applied ${files.join(', ')}. The answers table is ready (${row.n} answers stored).`);
await db.close();
