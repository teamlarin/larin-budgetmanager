import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const clientId = Deno.env.get('FATTURE_IN_CLOUD_CLIENT_ID')!;
const clientSecret = Deno.env.get('FATTURE_IN_CLOUD_CLIENT_SECRET')!;

const FIC_AUTH_URL = 'https://api-v2.fattureincloud.it/oauth/authorize';
const FIC_TOKEN_URL = 'https://api-v2.fattureincloud.it/oauth/token';

const PostBodySchema = z.object({
  action: z.enum(['get-auth-url', 'check-connection', 'disconnect']),
  appUrl: z.string().url().optional(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function decodeState(state: string): string {
  const fallback = `https://31978e0e-9f78-4c64-b31f-dc43fd04a2fe.lovableproject.com/settings`;
  try {
    const base64 = state.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const decoded = atob(padded);
    const stateData = JSON.parse(decoded);
    return stateData.appUrl || fallback;
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);

    // ── OAuth callback (GET with code+state) ──
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (code && state) {
      console.log('OAuth callback received');
      const appUrl = decodeState(state);

      const tokenResponse = await fetch(FIC_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${supabaseUrl}/functions/v1/fatture-in-cloud-oauth`,
        }),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error('Token exchange failed:', errText);
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get company info
      const companyResponse = await fetch('https://api-v2.fattureincloud.it/user/companies', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' },
      });

      if (!companyResponse.ok) throw new Error(`Company fetch failed: ${companyResponse.status}`);
      const companyData = await companyResponse.json();
      const company = companyData.data?.companies?.[0];
      if (!company) throw new Error('Nessuna azienda trovata nell\'account Fatture in Cloud');

      console.log('Company:', company.name);

      const tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

      // Replace existing tokens
      await supabase.from('fic_oauth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: insertError } = await supabase.from('fic_oauth_tokens').insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expiry: tokenExpiry.toISOString(),
        company_id: company.id,
        company_name: company.name,
      });
      if (insertError) throw new Error('Errore nel salvataggio dei token OAuth');

      const redirectUrl = new URL(appUrl);
      redirectUrl.searchParams.set('fic_connected', 'true');
      return new Response(null, { status: 302, headers: { ...corsHeaders, 'Location': redirectUrl.toString() } });
    }

    // ── GET without code (error or incomplete callback) ──
    if (req.method === 'GET') {
      const ficError = url.searchParams.get('error') || url.searchParams.get('error_description');
      const stateParam = url.searchParams.get('state');
      const redirectUrl = new URL(stateParam ? decodeState(stateParam) : `https://31978e0e-9f78-4c64-b31f-dc43fd04a2fe.lovableproject.com/settings`);
      redirectUrl.searchParams.set('fic_error', ficError || 'authorization_failed');
      return new Response(null, { status: 302, headers: { ...corsHeaders, 'Location': redirectUrl.toString() } });
    }

    // ── POST actions ──
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Body JSON non valido' }, 400);
    }

    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { action, appUrl: requestedAppUrl } = parsed.data;

    // JWT validation for POST actions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.user) {
      return jsonResponse({ error: 'Token non valido' }, 401);
    }

    // ── get-auth-url ──
    if (action === 'get-auth-url') {
      const statePayload = btoa(JSON.stringify({
        callbackUrl: `${supabaseUrl}/functions/v1/fatture-in-cloud-oauth`,
        appUrl: requestedAppUrl || 'https://lovable.dev',
      })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const redirectUri = `${supabaseUrl}/functions/v1/fatture-in-cloud-oauth`;
      const authUrl = new URL(FIC_AUTH_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'entity.suppliers:a settings:a issued_documents.quotes:a');
      authUrl.searchParams.set('state', statePayload);

      return jsonResponse({ authUrl: authUrl.toString() });
    }

    // ── check-connection ──
    if (action === 'check-connection') {
      const { data: tokens } = await supabase
        .from('fic_oauth_tokens')
        .select('token_expiry, company_name')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokens) return jsonResponse({ connected: false });
      const isExpired = new Date(tokens.token_expiry) < new Date();
      return jsonResponse({ connected: !isExpired, companyName: tokens.company_name, expiresAt: tokens.token_expiry });
    }

    // ── disconnect ──
    if (action === 'disconnect') {
      await supabase.from('fic_oauth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Azione non valida' }, 400);
  } catch (error) {
    console.error('FIC OAuth error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
