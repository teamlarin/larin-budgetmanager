import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    
    // Check if this is a callback from FIC
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (code && state) {
      // This is the OAuth callback
      console.log('Received OAuth callback with code');
      
      // Parse the state to get redirect URL - handle URL-safe base64
      let appUrl = 'https://31978e0e-9f78-4c64-b31f-dc43fd04a2fe.lovableproject.com/settings';
      try {
        // Handle URL-safe base64 by replacing characters
        const base64 = state.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
        const decoded = atob(padded);
        const stateData = JSON.parse(decoded);
        appUrl = stateData.appUrl || appUrl;
        console.log('Parsed state successfully, appUrl:', appUrl);
      } catch (e) {
        console.log('Could not parse state, using default redirect. Error:', e.message);
      }
      
      // Exchange code for tokens
      const tokenResponse = await fetch(FIC_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: `${supabaseUrl}/functions/v1/fatture-in-cloud-oauth`,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange error:', errorText);
        throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get company info
      const companyResponse = await fetch('https://api-v2.fattureincloud.it/user/companies', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!companyResponse.ok) {
        throw new Error(`Failed to get company info: ${companyResponse.status}`);
      }

      const companyData = await companyResponse.json();
      const company = companyData.data?.companies?.[0];
      
      if (!company) {
        throw new Error('No company found in Fatture in Cloud account');
      }

      console.log('Company found:', company.name);

      // Calculate token expiry (FIC tokens typically expire in 1 hour)
      const expiresIn = tokenData.expires_in || 3600;
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      // Delete existing tokens and insert new one
      await supabase.from('fic_oauth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      const { error: insertError } = await supabase
        .from('fic_oauth_tokens')
        .insert({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expiry: tokenExpiry.toISOString(),
          company_id: company.id,
          company_name: company.name,
        });

      if (insertError) {
        console.error('Error saving tokens:', insertError);
        throw new Error('Failed to save OAuth tokens');
      }

      console.log('Tokens saved successfully');

      // Redirect back to the app with success
      const appRedirectUrl = new URL(appUrl);
      appRedirectUrl.searchParams.set('fic_connected', 'true');
      
      console.log('Redirecting to:', appRedirectUrl.toString());
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': appRedirectUrl.toString(),
        },
      });
    }

    // Handle GET requests that aren't a successful OAuth callback (e.g. user denied, error from FIC)
    if (req.method === 'GET') {
      const ficError = url.searchParams.get('error') || url.searchParams.get('error_description');
      const stateParam = url.searchParams.get('state');
      
      // Try to extract appUrl from state for redirect
      let fallbackUrl = 'https://31978e0e-9f78-4c64-b31f-dc43fd04a2fe.lovableproject.com/settings';
      if (stateParam) {
        try {
          const base64 = stateParam.replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
          const decoded = atob(padded);
          const stateData = JSON.parse(decoded);
          fallbackUrl = stateData.appUrl || fallbackUrl;
        } catch { /* ignore */ }
      }

      const redirectUrl = new URL(fallbackUrl);
      redirectUrl.searchParams.set('fic_error', ficError || 'authorization_failed');
      console.log('OAuth error/incomplete callback, redirecting to:', redirectUrl.toString());

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
      });
    }

    // Handle API requests (POST only) - soft auth
    let authenticatedUser = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      authenticatedUser = data?.user || null;
    }

    let action: string | undefined;
    let appUrl: string | undefined;
    try {
      const body = await req.json();
      action = body.action;
      appUrl = body.appUrl;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('Action:', action);

    if (!authenticatedUser) {
      console.log('Warning: unauthenticated request for action:', action);
    }

    if (action === 'get-auth-url') {
      // Generate OAuth authorization URL
      const state = btoa(JSON.stringify({
        callbackUrl: `${supabaseUrl}/functions/v1/fatture-in-cloud-oauth`,
        appUrl: appUrl || 'https://lovable.dev',
      }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const redirectUri = `${supabaseUrl}/functions/v1/fatture-in-cloud-oauth`;
      
      console.log('=== OAuth Debug Info ===');
      console.log('Client ID:', clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET');
      console.log('Redirect URI:', redirectUri);
      console.log('Supabase URL:', supabaseUrl);

      const authUrl = new URL(FIC_AUTH_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'entity.suppliers:a settings:a issued_documents:a');
      authUrl.searchParams.set('state', state);

      console.log('Generated Auth URL:', authUrl.toString());

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check-connection') {
      // Check if we have valid tokens
      const { data: tokens } = await supabase
        .from('fic_oauth_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokens) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if token is expired
      const isExpired = new Date(tokens.token_expiry) < new Date();

      return new Response(
        JSON.stringify({ 
          connected: !isExpired,
          companyName: tokens.company_name,
          expiresAt: tokens.token_expiry,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      await supabase.from('fic_oauth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
