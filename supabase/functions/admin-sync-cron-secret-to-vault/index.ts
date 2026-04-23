// One-shot maintenance function: copies the CRON_SECRET edge-function env into vault.secrets
// so that pg_cron jobs can read it via vault.decrypted_secrets.
// Requires the caller to be authenticated AND have the 'admin' role in user_roles.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!cronSecret) {
      return json({ error: 'CRON_SECRET env var not set on edge function' }, 500)
    }

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const userId = claims.claims.sub as string

    // Verify admin via service role (bypasses RLS for the role check)
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleRow) {
      return json({ error: 'Forbidden: admin role required' }, 403)
    }

    // Push the secret into vault via the existing SECURITY DEFINER RPC
    const { data, error } = await admin.rpc('admin_set_cron_secret', { p_secret: cronSecret })

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ ok: true, message: data ?? 'CRON_SECRET vault entry set', length: cronSecret.length })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
