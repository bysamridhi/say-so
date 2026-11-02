// GET /api/wall            -> { version, total }            (anyone: the header's answer count)
// GET /api/wall?full=1&v=… -> { version, total, answers }   (only participants who submitted all 4 days)
//
// The page polls this every few seconds. `version` changes whenever any answer is added, edited
// or removed, so an unchanged poll returns { unchanged: true } without re-sending every answer.
// Answers are never returned with anything that links them to a participant.
import { getDb } from '../lib/db.js';
import { requireParticipant } from '../lib/auth.js';
import { HttpError, route, searchParams } from '../lib/http.js';
import { DAYS } from '../lib/probe.js';

export default route({
  async GET(req) {
    const params = searchParams(req);
    const db = await getDb();
    const [stats] = await db.query(
      `select count(*)::int as total, coalesce(max(updated_at)::text, '') as latest from answers`,
    );
    const version = `${stats.total}|${stats.latest}`;
    const result = { version, total: stats.total };
    if (params.get('full') !== '1') return result;
    if (params.get('v') === version) return { ...result, unchanged: true };

    const participantId = await requireParticipant(req);
    const [done] = await db.query('select count(*)::int as n from day_submissions where participant_id = $1', [participantId]);
    if (done.n < DAYS.length) throw new HttpError(403, 'Submit all four days to unlock The Wall.');

    const rows = await db.query('select id, prompt_id, text, is_chip from answers order by created_at, id');
    const answers = {};
    for (const r of rows) (answers[r.prompt_id] ||= []).push({ id: r.id, text: r.text, chip: r.is_chip });
    return { ...result, answers };
  },
});
