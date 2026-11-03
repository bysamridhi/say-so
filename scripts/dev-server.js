// Local stand-in for Vercel: serves public/ and runs the same api/*.js handlers.
//   npm run dev            -> http://localhost:3000 (also printed: a LAN address for testing from a phone)
//   npm run dev -- --seed  -> same, after adding 30 fake participants (--seed=60 for more)
// Without DATABASE_URL it uses a local Postgres (PGlite) stored in .local-db/.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const API_ROUTES = new Set(readdirSync(path.join(ROOT, 'api')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      const api = pathname.match(/^\/api\/([a-z-]+)\/?$/);
      if (api && API_ROUTES.has(api[1])) {
        const mod = await import(pathToFileURL(path.join(ROOT, 'api', `${api[1]}.js`)).href);
        return await mod.default(req, res);
      }
      if (pathname.startsWith('/api/')) return send(res, 404, 'application/json', '{"error":"Not found."}');

      let file = path.join(PUBLIC, decodeURIComponent(pathname));
      if (!file.startsWith(PUBLIC)) return send(res, 403, 'text/plain', 'Forbidden');
      if (pathname.endsWith('/')) file = path.join(file, 'index.html');
      const body = await readFile(file);
      return send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', body);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') return send(res, 404, 'text/plain', 'Not found');
      console.error(err);
      if (!res.headersSent) send(res, 500, 'text/plain', String(err.message || err));
    }
  });
}

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

// PGlite can only be opened by one process at a time, so the dev server leaves a pid file next to
// the local database while it runs. Returns that pid if the server is still alive.
const pidFile = () => path.resolve(ROOT, process.env.LOCAL_DB_DIR || '.local-db') + '.pid';
export function localDbHeldBy() {
  try {
    const pid = Number(readFileSync(pidFile(), 'utf8'));
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const f of ['.env.local', '.env']) {
    if (existsSync(path.join(ROOT, f))) process.loadEnvFile(path.join(ROOT, f));
  }
  process.chdir(ROOT);
  const { getDb } = await import('../lib/db.js');
  const db = await getDb();
  const holdsLocalDb = db.kind === 'local' && process.env.LOCAL_DB_DIR !== 'memory';
  if (holdsLocalDb) writeFileSync(pidFile(), String(process.pid));
  const seedArg = process.argv.find((a) => a === '--seed' || a.startsWith('--seed='));
  if (seedArg) {
    const { seedDatabase } = await import('../lib/seed.js');
    const finished = await seedDatabase(db, Number(seedArg.split('=')[1]) || 30);
    console.log(`\n  Added fake participants. Log in with ${finished[0]} to see The Wall.`);
    console.log('  Remove them later with: npm run seed -- --clear (with the server stopped)');
  }
  const port = Number(process.env.PORT) || 3000;
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    const where = db.kind === 'local' ? `local PGlite database in ${process.env.LOCAL_DB_DIR || '.local-db/'}` : 'DATABASE_URL';
    console.log(`\n  Say So is running — database: ${where}\n`);
    console.log(`  This computer:   http://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`  Phone (same Wi-Fi): http://${ip}:${port}`);
    console.log(`  Second account:  http://127.0.0.1:${port}  (separate browser storage = separate participant)`);
    console.log(`  CSV export:      http://localhost:${port}/api/export?key=${process.env.EXPORT_KEY || 'dev'}\n`);
  });
  const stop = async () => {
    server.close();
    await db.close();
    if (holdsLocalDb) rmSync(pidFile(), { force: true });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
