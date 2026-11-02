// Fills a running server with fake participants so The Wall can be checked with a crowd.
//   npm run seed            -> 8 fake participants against http://localhost:3000
//   npm run seed -- 25      -> 25 of them
// Prints each fake participant's code, so you can also log in as any of them.
// Refuses to touch anything but localhost unless you pass --allow-remote (then clear it before class!).
import { DAYS } from '../public/prompts.js';

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const count = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 8;
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) && !process.argv.includes('--allow-remote')) {
  console.error(`Refusing to seed ${base} — that isn't localhost. Add --allow-remote if you really mean it.`);
  process.exit(1);
}

const SAMPLE = ['too loud', 'what will people say', 'stays home after dark', 'my aunt, mostly', 'a sigh', 'a locked door',
  'nobody ever said why', 'it just changed', 'my grandmother → my mother → me', 'a closed window', 'respectable'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function call(path, { method = 'GET', code, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(code ? { authorization: `Bearer ${code}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error}`);
  return data;
}

for (let i = 1; i <= count; i++) {
  const { code } = await call('/api/join', { method: 'POST' });
  const days = Math.random() < 0.75 ? DAYS : DAYS.slice(0, 1 + Math.floor(Math.random() * 3));
  for (const day of days) {
    const answers = {};
    for (const p of day.prompts) {
      if (Math.random() < 0.25) continue; // skipped
      answers[p.id] = p.type === 'text'
        ? `[test ${i}] ${pick(SAMPLE)}`
        : p.multi ? p.options.filter(() => Math.random() < 0.4).slice(0, 3) : [pick(p.options)];
    }
    await call('/api/answers', { method: 'PUT', code, body: { day: day.key, answers } });
  }
  console.log(`${code}  (${days.length}/4 days)`);
}
const { total } = await call('/api/wall');
console.log(`\nDone. ${total} answers stored in total.`);
