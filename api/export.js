// GET /api/export?key=… — downloads every answer as a CSV for analysis after the session.
// Participants are numbered P01, P02… by join order so one person's answers can be read
// together, without anything identifying who they are. Fake participants from `npm run seed`
// are never included. Requires the EXPORT_KEY env var (locally it defaults to "dev").
import { createHash, timingSafeEqual } from 'node:crypto';
import { getDb } from '../lib/db.js';
import { HttpError, route, searchParams } from '../lib/http.js';
import { DAYS } from '../lib/probe.js';

const PROMPTS = DAYS.flatMap((day) => day.prompts.map((p, i) => ({ day, p, n: i + 1 })));
const ORDER = new Map(PROMPTS.map((x, i) => [x.p.id, i]));
const BY_ID = new Map(PROMPTS.map((x) => [x.p.id, x]));

function sameKey(a, b) {
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
}

function csvCell(value) {
  const s = value instanceof Date ? value.toISOString() : String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export default route({
  async GET(req, res) {
    const expected = process.env.EXPORT_KEY || (process.env.VERCEL ? '' : 'dev');
    if (!expected) throw new HttpError(404, 'Export is turned off. Set EXPORT_KEY in Vercel to enable it.');
    if (!sameKey(searchParams(req).get('key') || '', expected)) throw new HttpError(403, 'Wrong export key.');

    const db = await getDb();
    const participants = await db.query(
      `select p.id, row_number() over (order by p.created_at, p.id)::int as n,
              coalesce(string_agg(d.day_key, ' ' order by d.day_key), '') as days
         from participants p left join day_submissions d on d.participant_id = p.id
        where not p.is_seed
        group by p.id, p.created_at`,
    );
    const pmap = new Map(participants.map((p) => [p.id, p]));
    const answers = (await db.query('select participant_id, prompt_id, text, is_chip, created_at, updated_at from answers'))
      .filter((a) => pmap.has(a.participant_id)); // fake participants from `npm run seed` are left out
    answers.sort((a, b) => pmap.get(a.participant_id).n - pmap.get(b.participant_id).n
      || (ORDER.get(a.prompt_id) ?? 999) - (ORDER.get(b.prompt_id) ?? 999));

    const header = ['participant', 'days_submitted', 'day', 'day_title', 'question_no', 'prompt_id', 'question', 'answer', 'answer_type', 'first_saved', 'last_edited'];
    const lines = [header.map(csvCell).join(',')];
    for (const a of answers) {
      const p = pmap.get(a.participant_id);
      const info = BY_ID.get(a.prompt_id);
      lines.push([
        `P${String(p.n).padStart(2, '0')}`, p.days, info?.day.label ?? '', info?.day.title ?? '', info?.n ?? '',
        a.prompt_id, info?.p.q ?? '', a.text, a.is_chip ? 'choice' : 'text', a.created_at, a.updated_at,
      ].map(csvCell).join(','));
    }

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    res.statusCode = 200;
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="say-so-answers-${stamp}.csv"`);
    res.setHeader('cache-control', 'no-store');
    res.end('﻿' + lines.join('\r\n') + '\r\n'); // BOM so Excel reads the curly quotes correctly
  },
});
