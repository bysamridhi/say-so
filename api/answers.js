// PUT /api/answers — submit (or re-submit after editing) one day's answers.
// Body: { day: 'd1', answers: { d1_q1: 'text', d1_q8: ['A parent', 'A friend'], ... } }
import { getDb } from '../lib/db.js';
import { requireParticipant } from '../lib/auth.js';
import { readJson, route } from '../lib/http.js';
import { loadMe, parseDaySubmission, saveDay } from '../lib/probe.js';

export default route({
  async PUT(req) {
    const participantId = await requireParticipant(req);
    const { day, rows } = parseDaySubmission(await readJson(req));
    const db = await getDb();
    await saveDay(db, participantId, day, rows);
    return { saved: rows.length, skipped: day.prompts.length - rows.length, me: await loadMe(db, participantId) };
  },
});
