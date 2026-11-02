// GET /api/health — used by the diagnostics panel to show whether the server and database are reachable.
import { getDb } from '../lib/db.js';
import { route } from '../lib/http.js';

export default route({
  async GET() {
    const db = await getDb();
    const [row] = await db.query('select now() as now');
    return { ok: true, db: db.kind, time: row.now };
  },
});
