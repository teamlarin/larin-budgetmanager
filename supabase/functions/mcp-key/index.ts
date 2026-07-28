// MCP endpoint authenticated with TimeTrap API keys (tt_live_...).
// For MCP clients that only support a static Authorization header and cannot
// perform the OAuth 2.1 flow used by /functions/v1/mcp.
//
// Flow: validate the API key -> resolve the owning user -> mint a short-lived
// Supabase access token for that user (service role, server-side only) ->
// proxy the JSON-RPC request to the `mcp` function with that bearer.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-api-key, content-type, apikey, accept, mcp-session-id, mcp-protocol-version, last-event-id',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;
const REQUIRED_SCOPE = 'mcp:use';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function extractApiKey(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith('tt_')) return token;
  }
  const header = req.headers.get('x-api-key')?.trim();
  if (header?.startsWith('tt_')) return header;
  return null;
}

type KeyRecord = { id: string; created_by: string | null; scopes: string[] };

async function validateApiKey(token: string): Promise<{ record?: KeyRecord; error?: string; status?: number }> {
  const hash = await sha256(token);
  const { data, error } = await admin
    .from('api_keys')
    .select('id, created_by, scopes, revoked_at, expires_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error || !data) return { error: 'Invalid API key', status: 401 };
  if (data.revoked_at) return { error: 'API key revoked', status: 401 };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { error: 'API key expired', status: 401 };
  }
  if (!(data.scopes ?? []).includes(REQUIRED_SCOPE)) {
    return { error: `API key is missing the required scope: ${REQUIRED_SCOPE}`, status: 403 };
  }
  if (!data.created_by) return { error: 'API key has no owner user', status: 403 };

  return { record: { id: data.id, created_by: data.created_by, scopes: data.scopes ?? [] } };
}

// In-memory cache of minted user tokens (per isolate, best-effort).
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function mintUserToken(userId: string): Promise<string> {
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) {
    throw new Error('Cannot resolve the user account bound to this API key');
  }
  const email = userData.user.email;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Cannot mint a session for ${email}: ${linkErr?.message ?? 'no token returned'}`);
  }

  const verifier = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: verifyErr } = await verifier.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyErr || !sessionData?.session?.access_token) {
    throw new Error(`Cannot mint a session: ${verifyErr?.message ?? 'no session returned'}`);
  }

  const token = sessionData.session.access_token;
  const expiresAt = (sessionData.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000;
  tokenCache.set(userId, { token, expiresAt });
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return json(
      {
        error: 'unauthorized',
        message: 'Missing TimeTrap API key. Send "Authorization: Bearer tt_live_..." or the X-Api-Key header.',
      },
      401,
    );
  }

  const { record, error, status } = await validateApiKey(apiKey);
  if (!record) return json({ error: 'unauthorized', message: error }, status ?? 401);

  let userToken: string;
  try {
    userToken = await mintUserToken(record.created_by!);
  } catch (e) {
    console.error('mcp-key: token mint failed', e);
    return json({ error: 'internal_error', message: e instanceof Error ? e.message : 'Token mint failed' }, 500);
  }

  // Fire-and-forget usage tracking
  admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', record.id).then(() => {});

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${userToken}`);
  if (ANON_KEY) headers.set('apikey', ANON_KEY);
  headers.set('Content-Type', req.headers.get('content-type') ?? 'application/json');
  headers.set('Accept', req.headers.get('accept') ?? 'application/json, text/event-stream');
  const sessionId = req.headers.get('mcp-session-id');
  if (sessionId) headers.set('mcp-session-id', sessionId);
  const protocolVersion = req.headers.get('mcp-protocol-version');
  if (protocolVersion) headers.set('mcp-protocol-version', protocolVersion);
  const lastEventId = req.headers.get('last-event-id');
  if (lastEventId) headers.set('last-event-id', lastEventId);

  const upstream = await fetch(MCP_URL, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
  });

  const outHeaders = new Headers(corsHeaders);
  const contentType = upstream.headers.get('content-type');
  if (contentType) outHeaders.set('Content-Type', contentType);
  const upstreamSession = upstream.headers.get('mcp-session-id');
  if (upstreamSession) outHeaders.set('mcp-session-id', upstreamSession);

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
});
