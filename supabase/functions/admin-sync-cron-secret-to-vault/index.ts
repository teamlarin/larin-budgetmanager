// One-shot maintenance function: copies the CRON_SECRET edge-function env into vault.secrets
// so that pg_cron jobs can read it via vault.decrypted_secrets.
//
// Authorization: caller must be EITHER
//   - an authenticated user with the 'admin' role, OR
//   - presenting Bearer <SERVICE_ROLE_KEY> (bootstrap path for first-time vault setup).
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
      return json({ error: 'Unauthorized: missing Bearer token' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!cronSecret) {
      return json({ error: 'CRON_SECRET env var not set on edge function' }, 500)
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const admin = createClient(supabaseUrl, serviceKey)

    let authorized = false
    let mode = ''

    // Path A: bootstrap token = the service role key itself.
    if (token === serviceKey) {
      authorized = true
      mode = 'service-role-bootstrap'
    } else {
      // Path B: regular user JWT — must resolve to an admin profile.
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userErr } = await userClient.auth.getUser()
      if (userErr || !userData?.user?.id) {
        return json({ error: 'Unauthorized: invalid user token' }, 401)
      }
      const userId = userData.user.id
      const { data: roleRow } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle()

      if (!roleRow) {
        return json({ error: 'Forbidden: admin role required' }, 403)
      }
      authorized = true
      mode = `admin-user:${userId}`
    }

    if (!authorized) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // Push the secret into vault via the existing SECURITY DEFINER RPC
    const { data, error } = await admin.rpc('admin_set_cron_secret', { p_secret: cronSecret })
    if (error) {
      return json({ error: error.message, mode }, 500)
    }

    return json({ ok: true, mode, message: data ?? 'CRON_SECRET vault entry set', length: cronSecret.length })
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
