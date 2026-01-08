import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user token
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

    const apiKey = Deno.env.get('FATTURE_IN_CLOUD_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FATTURE_IN_CLOUD_API_KEY non configurata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json();

    // Get company ID
    const companyId = await getCompanyId(apiKey);
    console.log('Company ID:', companyId);

    if (action === 'check') {
      // Check existing subscriptions
      const subscriptions = await listSubscriptions(apiKey, companyId);
      return new Response(
        JSON.stringify({ subscriptions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'register') {
      // Register webhook subscription for suppliers
      const webhookUrl = `${supabaseUrl}/functions/v1/fatture-in-cloud-webhook`;
      
      const subscription = await createSubscription(apiKey, companyId, webhookUrl);
      
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
      await deleteSubscription(apiKey, companyId, subscriptionId);
      
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

async function getCompanyId(apiKey: string): Promise<number> {
  const response = await fetch('https://api-v2.fattureincloud.it/user/companies', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get company ID: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (!data.data?.companies?.[0]?.id) {
    throw new Error('Nessuna azienda trovata nell\'account Fatture in Cloud');
  }

  return data.data.companies[0].id;
}

async function listSubscriptions(apiKey: string, companyId: number): Promise<unknown[]> {
  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${companyId}/subscriptions`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('List subscriptions error:', text);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function createSubscription(apiKey: string, companyId: number, webhookUrl: string): Promise<unknown> {
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

  console.log('Creating subscription with body:', JSON.stringify(body));

  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${companyId}/subscriptions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

  const data = await response.json();
  return data.data;
}

async function deleteSubscription(apiKey: string, companyId: number, subscriptionId: string): Promise<void> {
  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${companyId}/subscriptions/${subscriptionId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Errore nell'eliminazione: ${text}`);
  }
}
