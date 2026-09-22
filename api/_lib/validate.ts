// api/_lib/validate.ts
//
// Shared request helpers for the Vercel serverless handlers under /api.
//
// Vercel does not deploy files inside `api/` whose name (or a parent directory
// name) starts with an underscore as Serverless Functions, so this module is
// importable by the handlers without becoming a public route. The `/api/(.*)`
// rewrite in vercel.json maps a path onto itself and therefore does not expose
// this file either.

import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Only the production web origin may make cross-origin calls to /api. */
export const ALLOWED_ORIGIN = 'https://infernodice.com';

/** Upper bound for any streak the client may report. */
export const STREAK_MAX = 1000;

/** All valid normalized dice codes (high die first). */
export const ALL_ROLL_CODES: readonly string[] = [
  '11', '21', '31', '41', '51', '61',
  '22', '32', '42', '52', '62',
  '33', '43', '53', '63',
  '44', '54', '64',
  '55', '65',
  '66',
];

const ROLL_CODE_SET = new Set(ALL_ROLL_CODES);

const DEVICE_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type JsonObject = Record<string, unknown>;

export type ParsedBody =
  | { ok: true; body: JsonObject }
  | { ok: false; error: string };

/**
 * Apply the common response headers: CORS (locked to the production origin),
 * and no-store caching so stats are never served stale from the CDN/browser.
 */
export function applyCommonHeaders(res: VercelResponse, methods: readonly HttpMethod[]): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
}

/**
 * Handles the request method preamble for a handler.
 *
 * - Applies the common headers.
 * - Answers CORS preflight (OPTIONS) with 204.
 * - Answers any method not in `methods` with 405 + Allow header.
 *
 * Returns `true` when a response has already been sent and the handler should
 * return immediately; `false` when the handler should continue.
 */
export function rejectUnsupportedMethod(
  req: VercelRequest,
  res: VercelResponse,
  methods: readonly HttpMethod[]
): boolean {
  applyCommonHeaders(res, methods);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  if (!req.method || !(methods as readonly string[]).includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }

  return false;
}

/**
 * Parse the request body as a JSON object.
 *
 * Vercel already parses JSON bodies when the content-type is application/json,
 * in which case `req.body` is an object. When it arrives as a raw string we
 * parse it ourselves. Anything that is not a plain object is rejected.
 */
export function parseJsonBody(req: VercelRequest): ParsedBody {
  const raw = req.body;

  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, body: {} };
  }

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Malformed JSON body' };
    }
  } else if (Buffer.isBuffer(raw)) {
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      return { ok: false, error: 'Malformed JSON body' };
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'JSON body must be an object' };
  }

  return { ok: true, body: parsed as JsonObject };
}

/**
 * Parse the body and, on failure, send a 400 response.
 * Returns the body object on success, or `null` when a 400 was already sent.
 */
export function requireJsonBody(req: VercelRequest, res: VercelResponse): JsonObject | null {
  const parsed = parseJsonBody(req);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return null;
  }
  return parsed.body;
}

/** True when `value` is one of the 21 normalized dice codes. */
export function isRollCode(value: unknown): value is string {
  return typeof value === 'string' && ROLL_CODE_SET.has(value);
}

/** True when `value` is a non-negative integer no larger than STREAK_MAX. */
export function isValidStreak(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= STREAK_MAX;
}

/** True when `value` looks like a client device id (UUID or `fallback-<ts>`). */
export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

/** Read Vercel's IP-geo headers, if present. */
export function readGeo(req: VercelRequest): { city: string | null; state: string | null } {
  const city = req.headers['x-vercel-ip-city'];
  const state = req.headers['x-vercel-ip-country-region'];
  return {
    city: typeof city === 'string' && city.length > 0 ? city : null,
    state: typeof state === 'string' && state.length > 0 ? state : null,
  };
}
