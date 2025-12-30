import { supabase } from '../lib/supabase';

type AnalyticsContext = {
  sessionId: string | null;
  userId: string | null;
};

type LogEventParams = {
  eventType: string;
  mode?: string | null;
  matchId?: string | null;
  onlineGameId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const context: AnalyticsContext = {
  sessionId: null,
  userId: null,
};

const recentKeys: string[] = [];
const recentKeySet = new Set<string>();
const MAX_RECENT_KEYS = 200;

const rememberKey = (key: string) => {
  if (recentKeySet.has(key)) return false;
  recentKeySet.add(key);
  recentKeys.push(key);
  if (recentKeys.length > MAX_RECENT_KEYS) {
    const removed = recentKeys.shift();
    if (removed) recentKeySet.delete(removed);
  }
  return true;
};

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
};

const getRandomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    return cryptoObj.getRandomValues(bytes);
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const createAnalyticsId = () => {
  const bytes = getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const setAnalyticsContext = (next: { sessionId?: string | null; userId?: string | null }) => {
  if (typeof next.sessionId !== 'undefined') {
    context.sessionId = next.sessionId;
  }
  if (typeof next.userId !== 'undefined') {
    context.userId = next.userId;
  }
};

export const logEvent = ({
  eventType,
  mode,
  matchId,
  onlineGameId,
  metadata,
}: LogEventParams) => {
  const sessionId = context.sessionId;
  if (!sessionId) return;

  const payloadMetadata = metadata ?? {};
  const dedupeKey = [
    eventType,
    mode ?? '',
    matchId ?? '',
    onlineGameId ?? '',
    safeStringify(payloadMetadata),
  ].join('|');

  if (!rememberKey(dedupeKey)) return;

  void (async () => {
    try {
      const { error } = await supabase.from('analytics_events').insert({
        user_id: context.userId ?? null,
        session_id: sessionId,
        event_type: eventType,
        mode: mode ?? null,
        match_id: matchId ?? null,
        online_game_id: onlineGameId ?? null,
        metadata: payloadMetadata,
      });

      if (error && __DEV__) {
        console.debug('[analytics] insert failed', error);
      }
    } catch (err) {
      if (__DEV__) {
        console.debug('[analytics] insert exception', err);
      }
    }
  })();
};
