// End-to-end API test: several anonymous participants, against a fresh in-memory database.
//   npm test
//   TEST_DATABASE_URL=postgresql://… npm test    (same test via `pg` against an EMPTY Postgres database)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.LOCAL_DB_DIR = 'memory';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
delete process.env.VERCEL;
delete process.env.EXPORT_KEY;

const { createServer } = await import('../scripts/dev-server.js');
const { getDb, migrate } = await import('../lib/db.js');

let server;
let base;
before(async () => {
  const db = await getDb();
  if (db.kind === 'postgres') await migrate((sql) => db.exec(sql));
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.close();
  await (await getDb()).close();
});

async function call(path, { method = 'GET', code, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(code ? { authorization: `Bearer ${code}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const join = async () => (await call('/api/join', { method: 'POST' })).data.code;
const submit = (code, day, answers) => call('/api/answers', { method: 'PUT', code, body: { day, answers } });

const allDays = {
  d2: { d2_q1: 'my aunt', d2_q2: ['Real'] },
  d3: { d3_q1: 'don’t laugh too loud', d3_q2: ['Voice'] },
  d4: { d4_q4: ['It partly fits'], d4_q5: 'just "how it is"' },
};

test('health check reports which database is in use', async () => {
  const { status, data } = await call('/api/health');
  assert.equal(status, 200);
  assert.equal(data.db, process.env.DATABASE_URL ? 'postgres' : 'local');
});

test('several participants store separate answers, and only their own can be edited', async () => {
  const [a, b, c] = [await join(), await join(), await join()];
  assert.match(a, /^[A-Z]+-[A-Z]+-\d{4}$/);
  assert.equal(new Set([a, b, c]).size, 3);

  assert.equal((await submit(a, 'd1', { d1_q1: 'speaks first', d1_q8: ['A parent', 'A teacher'], d1_q2: '  ' })).status, 200);
  assert.equal((await submit(b, 'd1', { d1_q1: 'talks back' })).status, 200);
  assert.equal((await submit(c, 'd1', { d1_q1: 'goes out at night', d1_q9: 'a sigh' })).status, 200);
  assert.equal((await call('/api/wall')).data.total, 5);

  // Each code sees only its own answers. Codes are case/spacing-insensitive.
  const meA = (await call('/api/me', { code: a.toLowerCase().replace(/-/g, ' ') })).data;
  assert.deepEqual(meA, { submittedDays: ['d1'], answers: { d1_q1: 'speaks first', d1_q8: ['A parent', 'A teacher'] } });
  assert.deepEqual((await call('/api/me', { code: b })).data.answers, { d1_q1: 'talks back' });

  // The Wall is locked server-side until all four days are submitted.
  assert.equal((await call('/api/wall?full=1', { code: a })).status, 403);
  for (const [day, answers] of Object.entries(allDays)) assert.equal((await submit(a, day, answers)).status, 200);
  const wall = (await call('/api/wall?full=1', { code: a })).data;
  assert.equal(wall.total, 11);
  assert.deepEqual(wall.answers.d1_q1.map((x) => x.text), ['speaks first', 'talks back', 'goes out at night']);
  assert.deepEqual(wall.answers.d1_q8, [{ id: wall.answers.d1_q8[0].id, text: 'A parent, A teacher', chip: true }]);
  for (const list of Object.values(wall.answers)) {
    for (const item of list) assert.deepEqual(Object.keys(item).sort(), ['chip', 'id', 'text']); // nothing links answers to a person
  }

  // Unchanged data -> cheap "unchanged" reply.
  assert.equal((await call(`/api/wall?full=1&v=${encodeURIComponent(wall.version)}`, { code: a })).data.unchanged, true);

  // A edits Day 1: changes one answer, clears another. B and C are untouched.
  const edit = await submit(a, 'd1', { d1_q1: 'never interrupts', d1_q8: [] });
  assert.equal(edit.status, 200);
  assert.deepEqual(edit.data.me.answers.d1_q8, undefined);
  const wall2 = (await call(`/api/wall?full=1&v=${encodeURIComponent(wall.version)}`, { code: a })).data;
  assert.notEqual(wall2.version, wall.version);
  assert.equal(wall2.total, 10);
  assert.deepEqual(wall2.answers.d1_q1.map((x) => x.text), ['never interrupts', 'talks back', 'goes out at night']);
  assert.equal(wall2.answers.d1_q8, undefined);
  assert.deepEqual((await call('/api/me', { code: c })).data.answers, { d1_q1: 'goes out at night', d1_q9: 'a sigh' });

  // Re-saving identical answers doesn't count as a change.
  await submit(c, 'd1', { d1_q1: 'goes out at night', d1_q9: 'a sigh' });
  assert.equal((await call('/api/wall')).data.version, wall2.version);
});

test('bad codes and bad answers are rejected', async () => {
  const code = await join();
  assert.equal((await call('/api/me')).status, 401);
  assert.equal((await call('/api/me', { code: 'NOPE-NOPE-0000' })).status, 401);
  assert.equal((await submit('NOPE-NOPE-0000', 'd1', { d1_q1: 'x' })).status, 401);
  assert.equal((await submit(code, 'd9', {})).status, 400);
  assert.equal((await submit(code, 'd1', { d2_q1: 'wrong day' })).status, 400);
  assert.equal((await submit(code, 'd1', { d1_q8: ['Someone made up'] })).status, 400);
  assert.equal((await submit(code, 'd2', { d2_q2: ['Real', 'Imagined'] })).status, 400); // single-choice
  assert.equal((await submit(code, 'd1', { d1_q1: 'x'.repeat(501) })).status, 400);
  assert.equal((await submit(code, 'd1', { d1_q1: 42 })).status, 400);
  assert.equal((await call('/api/answers', { method: 'DELETE', code })).status, 405);
});

test('CSV export needs the key and groups answers by question', async () => {
  assert.equal((await call('/api/export')).status, 403);
  const { status, data } = await call('/api/export?key=dev');
  assert.equal(status, 200);
  const lines = data.replace(/^﻿/, '').trim().split('\r\n');
  assert.match(lines[0], /^"day","day_title","question_no","prompt_id","question","answer","answer_type","participant"/);
  assert.equal(lines.length, 1 + 10);

  // All of a question's answers sit together, oldest first, before the next question's.
  const rows = lines.slice(1).map((l) => l.slice(1, -1).split('","'));
  assert.deepEqual(rows.slice(0, 3).map((r) => [r[3], r[5], r[7]]), [
    ['d1_q1', 'never interrupts', 'P01'],
    ['d1_q1', 'talks back', 'P02'],
    ['d1_q1', 'goes out at night', 'P03'],
  ]);
  const promptOrder = rows.map((r) => r[3]);
  assert.deepEqual(promptOrder, [...promptOrder].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
});

test('seeding fills The Wall with fake participants that --clear removes again', async () => {
  const { seedDatabase, clearSeed } = await import('../lib/seed.js');
  const db = await getDb();
  const before = (await call('/api/wall')).data.total;
  const finished = await seedDatabase(db, 12);
  assert.ok(finished.length > 0);

  // A seeded code that finished all four days opens a well-filled Wall.
  const wall = (await call('/api/wall?full=1', { code: finished[0] })).data;
  assert.ok(wall.total > before + 100);
  assert.ok(wall.answers.d1_q1.length > 8);

  // The CSV export only contains the real participants' answers.
  const csv = (await call('/api/export?key=dev')).data.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(csv.length, 1 + 10);

  assert.equal(await clearSeed(db), 12);
  assert.equal((await call('/api/wall')).data.total, before);
});
