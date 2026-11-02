// Small request/response helpers that only use plain Node APIs, so the same api/*.js handlers
// run unchanged on Vercel and in scripts/dev-server.js.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

// Wraps per-method handlers. A handler returns the JSON body, or writes the response itself.
export function route(handlers) {
  return async function handler(req, res) {
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader('allow', Object.keys(handlers).join(', '));
      return sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    }
    try {
      const body = await fn(req, res);
      if (!res.writableEnded) sendJson(res, 200, body);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      // The real error text is returned on purpose: the on-page diagnostics panel shows it, which
      // is how problems get reported when testing from a phone with no devtools.
      sendJson(res, status, { error: err.message || 'Server error.' });
    }
  };
}

export function searchParams(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export async function readJson(req) {
  // Vercel pre-parses JSON bodies onto req.body; the local dev server leaves the stream unread.
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    return parseJson(String(req.body));
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  return chunks.length ? parseJson(Buffer.concat(chunks).toString('utf8')) : {};
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
}
