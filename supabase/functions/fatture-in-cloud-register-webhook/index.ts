import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Solo gli admin possono registrare il webhook' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth tokens from database
    const { data: oauthTokens } = await supabase
      .from('fic_oauth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!oauthTokens) {
      return new Response(
        JSON.stringify({ error: 'Fatture in Cloud non connesso. Collegare prima l\'account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (new Date(oauthTokens.token_expiry) < new Date()) {
      // Try to refresh the token
      const refreshed = await refreshAccessToken(supabase, oauthTokens);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: 'Token scaduto. Ricollegare l\'account Fatture in Cloud.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Use refreshed token
      oauthTokens.access_token = refreshed.access_token;
    }

    const accessToken = oauthTokens.access_token;
    const companyId = oauthTokens.company_id;

    const { action } = await req.json();
    console.log('Action:', action, 'Company ID:', companyId);

    if (action === 'check') {
      const subscriptions = await listSubscriptions(accessToken, companyId);
      return new Response(
        JSON.stringify({ subscriptions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'register') {
      const webhookUrl = `${supabaseUrl}/functions/v1/fatture-in-cloud-webhook`;
      const subscription = await createSubscription(accessToken, companyId, webhookUrl);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook registrato con successo',
          subscription 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      const { subscriptionId } = await req.json();
      await deleteSubscription(accessToken, companyId, subscriptionId);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Subscription eliminata' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Azione non valida' }),
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

async function refreshAccessToken(supabase: ReturnType<typeof createClient>, tokens: { id: string; refresh_token: string }): Promise<{ access_token: string } | null> {
  const clientId = Deno.env.get('FATTURE_IN_CLOUD_CLIENT_ID');
  const clientSecret = Deno.env.get('FATTURE_IN_CLOUD_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.error('Missing OAuth credentials for refresh');
    return null;
  }

  try {
    const response = await fetch('https://api-v2.fattureincloud.it/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      console.error('Refresh token failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await supabase
      .from('fic_oauth_tokens')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        token_expiry: tokenExpiry.toISOString(),
      })
      .eq('id', tokens.id);

    return { access_token: data.access_token };
  } catch (e) {
    console.error('Refresh token error:', e);
    return null;
  }
}

async function listSubscriptions(accessToken: string, companyId: number): Promise<unknown[]> {
  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${companyId}/subscriptions`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.error('List subscriptions error:', await response.text());
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function createSubscription(accessToken: string, companyId: number, webhookUrl: string): Promise<unknown> {
  const body = {
    data: {
      sink: webhookUrl,
      types: [
        'entities.suppliers.create',
        'entities.suppliers.update', 
        'entities.suppliers.delete'
      ]
    }
  };

  console.log('Creating subscription:', JSON.stringify(body));

  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${companyId}/subscriptions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('Create subscription error:', text);
    throw new Error(`Errore nella creazione del webhook: ${text}`);
  }

  return (await response.json()).data;
}

async function deleteSubscription(accessToken: string, companyId: number, subscriptionId: string): Promise<void> {
  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${companyId}/subscriptions/${subscriptionId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Errore nell'eliminazione: ${await response.text()}`);
  }
}
