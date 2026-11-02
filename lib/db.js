// Database connection shared by every API route.
//
// - DATABASE_URL set (Supabase, or any Postgres): connects with `pg`.
// - DATABASE_URL unset (local dev only): runs a real Postgres in-process with PGlite, stored in
//   .local-db/ (or in memory with LOCAL_DB_DIR=memory), and applies supabase/migrations on boot.
//
// Both expose the same tiny interface: query(sql, params) -> rows, tx(fn), exec(sql), close().
import { readdir, readFile } from 'node:fs/promises';

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);

let dbPromise;
export function getDb() {
  if (!dbPromise) {
    dbPromise = connect().catch((err) => {
      dbPromise = undefined; // let the next request retry instead of caching the failure
      throw err;
    });
  }
  return dbPromise;
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (url) return connectPostgres(url);
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set. Add the Supabase connection string in Vercel → Settings → Environment Variables.');
  }
  return connectLocal();
}

async function connectPostgres(url) {
  const { default: pg } = await import('pg');
  const u = new URL(url);
  u.searchParams.delete('sslmode'); // TLS is configured below; pg would otherwise insist on full cert verification
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  const pool = new pg.Pool({
    connectionString: u.toString(),
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return {
    kind: 'postgres',
    query: (text, params) => pool.query(text, params).then((r) => r.rows),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn((text, params) => client.query(text, params).then((r) => r.rows));
        await client.query('commit');
        return out;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  };
}

async function connectLocal() {
  // Kept out of static analysis so Vercel never bundles PGlite into the serverless functions.
  const pkg = '@electric-sql/pglite';
  const { PGlite } = await import(pkg);
  const dir = process.env.LOCAL_DB_DIR || '.local-db';
  const db = dir === 'memory' ? new PGlite() : new PGlite(dir);
  await db.waitReady;
  await migrate((sql) => db.exec(sql));
  return {
    kind: 'local',
    query: (text, params) => db.query(text, params).then((r) => r.rows),
    tx: (fn) => db.transaction((tx) => fn((text, params) => tx.query(text, params).then((r) => r.rows))),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}

export async function migrate(exec) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await exec(await readFile(new URL(file, MIGRATIONS_DIR), 'utf8'));
  }
  return files;
}
