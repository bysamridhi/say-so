// POST /api/join — creates a new anonymous participant and returns their return code.
import { getDb } from '../lib/db.js';
import { hashCode, newCode } from '../lib/codes.js';
import { HttpError, clientIp, route } from '../lib/http.js';
import { record, tooMany } from '../lib/ratelimit.js';

const JOIN_LIMIT = 120;
const JOIN_WINDOW_MS = 60 * 1000;

export default route({
  async POST(req) {
    const key = `join:${clientIp(req)}`;
    if (tooMany(key, JOIN_LIMIT, JOIN_WINDOW_MS)) throw new HttpError(429, 'Too many people joining from this network at once. Try again in a minute.');
    record(key, JOIN_WINDOW_MS);

    const db = await getDb();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const rows = await db.query(
        'insert into participants (code_hash) values ($1) on conflict (code_hash) do nothing returning id',
        [hashCode(code)],
      );
      if (rows.length) return { code, me: { submittedDays: [], answers: {} } };
    }
    throw new Error('Could not create a unique code. Try again.');
  },
});
