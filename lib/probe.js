// Probe content (shared with the page) plus the server-side rules for saving answers.
import { DAYS } from '../public/prompts.js';
import { HttpError } from './http.js';

export { DAYS };
export const MAX_TEXT = 500;

const DAY_BY_KEY = new Map(DAYS.map((d) => [d.key, d]));

// Validates a "submit day" request body: { day: 'd1', answers: { d1_q1: 'text', d1_q8: ['A parent'] } }.
// Blank or missing prompts are skipped. Returns the rows to store for that day.
export function parseDaySubmission(body) {
  const day = DAY_BY_KEY.get(body?.day);
  if (!day) throw new HttpError(400, 'Unknown day.');
  const given = body.answers && typeof body.answers === 'object' ? body.answers : {};
  for (const id of Object.keys(given)) {
    if (!day.prompts.some((p) => p.id === id)) throw new HttpError(400, `Unknown question "${id}" for ${day.label}.`);
  }

  const rows = [];
  for (const p of day.prompts) {
    const value = given[p.id];
    if (value === undefined || value === null) continue;
    if (p.type === 'text') {
      if (typeof value !== 'string') throw new HttpError(400, `Answer to ${p.id} must be text.`);
      const text = value.trim();
      if (!text) continue;
      if (text.length > MAX_TEXT) throw new HttpError(400, `Answer to ${p.id} is too long (max ${MAX_TEXT} characters).`);
      rows.push({ prompt_id: p.id, text, choices: null, is_chip: false });
    } else {
      const picked = [...new Set(Array.isArray(value) ? value : [value])];
      if (picked.some((o) => !p.options.includes(o))) throw new HttpError(400, `Unknown option for ${p.id}.`);
      if (!p.multi && picked.length > 1) throw new HttpError(400, `Pick only one option for ${p.id}.`);
      if (!picked.length) continue;
      rows.push({ prompt_id: p.id, text: picked.join(', '), choices: picked, is_chip: true });
    }
  }
  return { day, rows };
}

// Replaces a participant's answers for one day: upserts what was filled in, removes what was
// cleared (an edit that blanks an answer takes it back off The Wall), and marks the day submitted.
export async function saveDay(db, participantId, day, rows) {
  await db.tx(async (q) => {
    await q(
      `delete from answers
        where participant_id = $1 and prompt_id = any($2::text[]) and not (prompt_id = any($3::text[]))`,
      [participantId, day.prompts.map((p) => p.id), rows.map((r) => r.prompt_id)],
    );
    for (const r of rows) {
      await q(
        `insert into answers (participant_id, prompt_id, text, choices, is_chip)
         values ($1, $2, $3, $4, $5)
         on conflict (participant_id, prompt_id) do update
           set text = excluded.text, choices = excluded.choices, is_chip = excluded.is_chip, updated_at = now()
           where answers.text is distinct from excluded.text or answers.choices is distinct from excluded.choices`,
        [participantId, r.prompt_id, r.text, r.choices, r.is_chip],
      );
    }
    await q(
      `insert into day_submissions (participant_id, day_key) values ($1, $2)
       on conflict (participant_id, day_key) do update set last_submitted_at = now()`,
      [participantId, day.key],
    );
  });
}

// Everything the page needs to restore one participant's state on any device.
export async function loadMe(db, participantId) {
  const answers = await db.query(
    'select prompt_id, text, choices, is_chip from answers where participant_id = $1',
    [participantId],
  );
  const days = await db.query('select day_key from day_submissions where participant_id = $1', [participantId]);
  const submitted = new Set(days.map((d) => d.day_key));
  return {
    submittedDays: DAYS.filter((d) => submitted.has(d.key)).map((d) => d.key),
    answers: Object.fromEntries(answers.map((a) => [a.prompt_id, a.is_chip ? a.choices : a.text])),
  };
}
