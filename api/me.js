// GET /api/me — the logged-in participant's own answers and submitted days. Also how "log in
// with your code" works: a 200 means the code is valid.
import { getDb } from '../lib/db.js';
import { requireParticipant } from '../lib/auth.js';
import { route } from '../lib/http.js';
import { loadMe } from '../lib/probe.js';

export default route({
  async GET(req) {
    const participantId = await requireParticipant(req);
    return loadMe(await getDb(), participantId);
  },
});
