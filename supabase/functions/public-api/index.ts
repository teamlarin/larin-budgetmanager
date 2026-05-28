import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, apikey',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface AuthResult {
  ok: boolean;
  keyId?: string;
  scopes?: string[];
  error?: string;
  status?: number;
}

async function authenticate(req: Request): Promise<AuthResult> {
  const auth = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';
  let token = '';
  if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  if (!token) return { ok: false, status: 401, error: 'Missing API key. Use Authorization: Bearer <key> or X-Api-Key header.' };
  if (!token.startsWith('tt_')) return { ok: false, status: 401, error: 'Invalid API key format' };

  const hash = await sha256(token);
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, scopes, revoked_at, expires_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 401, error: 'Invalid API key' };
  if (data.revoked_at) return { ok: false, status: 401, error: 'API key revoked' };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, status: 401, error: 'API key expired' };
  }

  // Fire and forget last_used_at update
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});

  return { ok: true, keyId: data.id, scopes: data.scopes ?? [] };
}

async function logRequest(params: {
  apiKeyId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  ip?: string;
  userAgent?: string;
  errorMessage?: string;
}) {
  try {
    await supabase.from('api_request_logs').insert({
      api_key_id: params.apiKeyId ?? null,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      latency_ms: params.latencyMs,
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      error_message: params.errorMessage ?? null,
    });
  } catch (_) { /* ignore */ }
}

// Simple in-memory rate limiter (per-instance, best-effort)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(keyId);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(keyId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

const PROJECT_SELECT = `
  id, name, description, status, project_status, area, discipline,
  start_date, end_date, progress, manual_quote_number,
  drive_folder_id, drive_folder_name, account_user_id, project_leader_id,
  created_at, updated_at,
  client:clients(id, name)
`;

const fullName = (u: any) =>
  u ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || null : null;

async function fetchProfilesMap(ids: string[]): Promise<Map<string, any>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', unique);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

function serializeProject(p: any, profiles: Map<string, any>) {
  const account = p.account_user_id ? profiles.get(p.account_user_id) : null;
  const leader = p.project_leader_id ? profiles.get(p.project_leader_id) : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    status: p.status,
    project_status: p.project_status ?? null,
    area: p.area ?? null,
    discipline: p.discipline ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
    progress: p.progress ?? null,
    quote_number: p.manual_quote_number ?? null,
    drive_folder: p.drive_folder_id
      ? {
          id: p.drive_folder_id,
          name: p.drive_folder_name ?? null,
          url: `https://drive.google.com/drive/folders/${p.drive_folder_id}`,
        }
      : null,
    client: p.client ? { id: p.client.id, name: p.client.name } : null,
    account: account ? { id: account.id, name: fullName(account), email: account.email } : null,
    project_leader: leader ? { id: leader.id, name: fullName(leader), email: leader.email } : null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const start = Date.now();
  const url = new URL(req.url);
  // Strip the /public-api prefix (Supabase routes the function name as the first path segment)
  const pathname = url.pathname.replace(/^\/public-api/, '') || '/';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  let apiKeyId: string | undefined;
  let statusCode = 200;
  let errorMessage: string | undefined;

  try {
    // Health endpoint — no auth
    if (pathname === '/health' || pathname === '/') {
      return json({ status: 'ok', service: 'timetrap-public-api', version: 'v1' });
    }

    // Authenticate
    const auth = await authenticate(req);
    if (!auth.ok) {
      statusCode = auth.status ?? 401;
      errorMessage = auth.error;
      return json({ error: auth.error, code: 'unauthorized' }, statusCode);
    }
    apiKeyId = auth.keyId;

    // Rate limit
    if (!checkRateLimit(auth.keyId!)) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded';
      return json({ error: 'Rate limit exceeded (60 req/min)', code: 'rate_limited' }, 429);
    }

    // Scope check
    const hasProjectsRead = (auth.scopes ?? []).includes('projects:read');
    if (!hasProjectsRead) {
      statusCode = 403;
      errorMessage = 'Missing scope projects:read';
      return json({ error: 'Missing required scope: projects:read', code: 'forbidden' }, 403);
    }

    // Routing
    if (req.method !== 'GET') {
      statusCode = 405;
      return json({ error: 'Method not allowed', code: 'method_not_allowed' }, 405);
    }

    // GET /projects/:id
    const detailMatch = pathname.match(/^\/projects\/([0-9a-f-]{36})$/i);
    if (detailMatch) {
      const id = detailMatch[1];
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (error) {
        statusCode = 500;
        errorMessage = error.message;
        return json({ error: error.message, code: 'internal_error' }, 500);
      }
      if (!data) {
        statusCode = 404;
        return json({ error: 'Project not found', code: 'not_found' }, 404);
      }
      return json({ data: serializeProject(data) });
    }

    // GET /projects
    if (pathname === '/projects') {
      const params = url.searchParams;
      const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 200);
      const cursor = params.get('cursor'); // ISO updated_at of last item
      const status = params.get('status');
      const projectStatus = params.get('project_status');
      const area = params.get('area');
      const clientId = params.get('client_id');
      const updatedSince = params.get('updated_since');

      let query = supabase
        .from('projects')
        .select(PROJECT_SELECT, { count: 'exact' })
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);
      if (projectStatus) query = query.eq('project_status', projectStatus);
      if (area) query = query.eq('area', area);
      if (clientId) query = query.eq('client_id', clientId);
      if (updatedSince) query = query.gte('updated_at', updatedSince);
      if (cursor) query = query.lt('updated_at', cursor);

      const { data, error, count } = await query;
      if (error) {
        statusCode = 500;
        errorMessage = error.message;
        return json({ error: error.message, code: 'internal_error' }, 500);
      }
      const items = (data ?? []).map(serializeProject);
      const nextCursor = items.length === limit ? items[items.length - 1].updated_at : null;
      return json({ data: items, next_cursor: nextCursor, total: count ?? null });
    }

    statusCode = 404;
    return json({ error: 'Endpoint not found', code: 'not_found' }, 404);
  } catch (e) {
    statusCode = 500;
    errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('public-api error:', e);
    return json({ error: 'Internal server error', code: 'internal_error' }, 500);
  } finally {
    logRequest({
      apiKeyId,
      endpoint: pathname,
      method: req.method,
      statusCode,
      latencyMs: Date.now() - start,
      ip,
      userAgent,
      errorMessage,
    });
  }
});
