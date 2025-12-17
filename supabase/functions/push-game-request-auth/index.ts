import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.1';

type GameRequestAuthPayload = {
  targetUserId?: string;
  gameId?: string;
};

type UserPushToken = {
  expo_push_token: string;
};

type UserRecord = {
  username: string | null;
};

type ExpoPushResponse = {
  data?: {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: {
      error?: string;
    };
  }[];
  errors?: unknown;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[push-game-request-auth] missing Supabase env vars');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    console.warn('[push-game-request-auth] missing Authorization bearer token');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser(token);

  if (userError || !user) {
    console.warn('[push-game-request-auth] failed to get user from JWT', userError);
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const senderUserId = user.id;

  let payload: GameRequestAuthPayload;
  try {
    payload = (await req.json()) as GameRequestAuthPayload;
  } catch (err) {
    console.error('[push-game-request-auth] failed to parse JSON body', err);
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { targetUserId, gameId } = payload;

  if (!targetUserId || !gameId) {
    console.warn('[push-game-request-auth] missing required fields', {
      targetUserId,
      gameId,
    });
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: tokens, error: tokensError } = await supabaseClient
    .from('user_push_tokens')
    .select('expo_push_token')
    .eq('user_id', targetUserId)
    .eq('is_enabled', true);

  if (tokensError) {
    console.error('[push-game-request-auth] failed to load user tokens', tokensError);
    return new Response(JSON.stringify({ error: 'token_query_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const enabledTokens = (tokens as UserPushToken[] | null) ?? [];

  if (enabledTokens.length === 0) {
    console.log('[push-game-request-auth] no enabled tokens for user', { targetUserId });
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let senderUsername = 'Someone';

  try {
    const { data: sender, error: senderError } = await supabaseClient
      .from('users')
      .select('username')
      .eq('id', senderUserId)
      .single();

    if (!senderError && sender) {
      const record = sender as UserRecord;
      if (typeof record.username === 'string' && record.username.trim().length > 0) {
        senderUsername = record.username.trim();
      }
    }
  } catch (err) {
    console.error('[push-game-request-auth] failed to load sender username', err);
  }

  const title = 'Game request';
  const body = `${senderUsername} sent a game request`;

  const messages = enabledTokens.map((tokenRow) => ({
    to: tokenRow.expo_push_token,
    title,
    body,
    data: { gameId, type: 'game_request' as const },
  }));

  try {
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoJson = (await expoResponse.json()) as ExpoPushResponse;

    const results = expoJson.data ?? [];
    let sentCount = 0;

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const tokenRow = enabledTokens[i];

      if (!result) continue;

      if (result.status === 'ok') {
        sentCount += 1;
        continue;
      }

      const errorCode = result.details?.error ?? '';
      const message = result.message ?? '';

      console.warn('[push-game-request-auth] Expo push error for token', {
        token: tokenRow.expo_push_token,
        errorCode,
        message,
      });

      if (errorCode === 'DeviceNotRegistered' || message.includes('DeviceNotRegistered')) {
        const { error: disableError } = await supabaseClient
          .from('user_push_tokens')
          .update({ is_enabled: false })
          .eq('user_id', targetUserId)
          .eq('expo_push_token', tokenRow.expo_push_token);

        if (disableError) {
          console.error('[push-game-request-auth] failed to disable token', {
            token: tokenRow.expo_push_token,
            error: disableError,
          });
        } else {
          console.log('[push-game-request-auth] disabled invalid token', {
            token: tokenRow.expo_push_token,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[push-game-request-auth] failed to send Expo push', err);
    return new Response(JSON.stringify({ error: 'expo_push_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Deployment checklist:
// - supabase functions deploy push-game-request-auth
// - Ensure env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set for the function
// - Client: uses supabase.functions.invoke('push-game-request-auth', ...) after creating friend match

