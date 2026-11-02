// The client sends its return code as `Authorization: Bearer <code>` on requests that touch
// its own answers. There are no sessions or cookies: the code is the credential.
import { getDb } from './db.js';
import { hashCode, normalizeCode } from './codes.js';
import { HttpError, clientIp } from './http.js';
import { record, tooMany } from './ratelimit.js';

const FAILED_LIMIT = 30;
const FAILED_WINDOW_MS = 10 * 60 * 1000;

export function bearerCode(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

// Resolves the participant id for the request's code, or throws 401.
export async function requireParticipant(req) {
  const code = bearerCode(req);
  if (!normalizeCode(code)) throw new HttpError(401, 'Not logged in.');

  const key = `failed-code:${clientIp(req)}`;
  if (tooMany(key, FAILED_LIMIT, FAILED_WINDOW_MS)) {
    throw new HttpError(429, 'Too many wrong codes from this network. Wait a few minutes and try again.');
  }
  const db = await getDb();
  const rows = await db.query(
    'update participants set last_seen_at = now() where code_hash = $1 returning id',
    [hashCode(code)],
  );
  if (!rows.length) {
    record(key, FAILED_WINDOW_MS);
    throw new HttpError(401, 'That code doesn’t match anyone. Check it for typos.');
  }
  return rows[0].id;
}
