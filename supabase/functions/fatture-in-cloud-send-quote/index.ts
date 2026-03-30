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

const FIC_API_BASE = 'https://api-v2.fattureincloud.it';
const FIC_TOKEN_URL = `${FIC_API_BASE}/oauth/token`;

interface FicToken {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  company_id: number;
}

async function getValidToken(supabase: any): Promise<FicToken> {
  const { data: tokens, error } = await supabase
    .from('fic_oauth_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !tokens) {
    throw new Error('Nessun token FIC trovato. Collega prima il tuo account Fatture in Cloud.');
  }

  // Check if token is expired (with 5 min buffer)
  const isExpired = new Date(tokens.token_expiry) < new Date(Date.now() + 5 * 60 * 1000);

  if (!isExpired) {
    return tokens;
  }

  // Refresh the token
  console.log('Token expired, refreshing...');
  const response = await fetch(FIC_TOKEN_URL, {
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
    const errText = await response.text();
    console.error('Token refresh failed:', errText);
    throw new Error('Token FIC scaduto e refresh fallito. Ricollega il tuo account.');
  }

  const tokenData = await response.json();
  const expiresIn = tokenData.expires_in || 3600;
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

  await supabase
    .from('fic_oauth_tokens')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || tokens.refresh_token,
      token_expiry: tokenExpiry.toISOString(),
    })
    .eq('id', tokens.id);

  return {
    ...tokens,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || tokens.refresh_token,
    token_expiry: tokenExpiry.toISOString(),
  };
}

async function ficRequest(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${FIC_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FIC API error ${res.status} on ${path}:`, text);
    throw new Error(`Errore API Fatture in Cloud: ${res.status} - ${text}`);
  }
  return JSON.parse(text);
}

async function findOrCreateFicClient(
  supabase: any,
  token: string,
  companyId: number,
  client: any
): Promise<number> {
  // If client already has a fic_id, use it
  if (client.fic_id) {
    return client.fic_id;
  }

  // Search by name
  const searchResult = await ficRequest(token, `/c/${companyId}/entities/clients?q=${encodeURIComponent(client.name)}`);
  const existing = searchResult?.data?.find((e: any) => 
    e.name?.toLowerCase() === client.name?.toLowerCase()
  );

  if (existing) {
    // Save fic_id to our DB
    await supabase.from('clients').update({ fic_id: existing.id }).eq('id', client.id);
    return existing.id;
  }

  // Create new client entity in FIC
  const createResult = await ficRequest(token, `/c/${companyId}/entities/clients`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        name: client.name,
        email: client.email || undefined,
        phone: client.phone || undefined,
        type: 'company',
      },
    }),
  });

  const ficId = createResult?.data?.id;
  if (!ficId) {
    throw new Error('Impossibile creare il cliente su Fatture in Cloud');
  }

  // Save fic_id
  await supabase.from('clients').update({ fic_id: ficId }).eq('id', client.id);
  return ficId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quoteId } = await req.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId è obbligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load quote with budget/project and client
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        budgets (
          *,
          clients (*)
        )
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error('Preventivo non trovato');
    }

    const budget = quote.budgets;
    const client = budget?.clients;

    if (!client) {
      throw new Error('Il preventivo non ha un cliente associato. Associa un cliente prima di inviare a FIC.');
    }

    // Get FIC token
    const ficToken = await getValidToken(supabase);
    const { access_token, company_id } = ficToken;

    // Find or create client in FIC
    const ficClientId = await findOrCreateFicClient(supabase, access_token, company_id, client);

    // Load budget items (products and services)
    const budgetId = quote.budget_id || quote.project_id;
    const { data: budgetItems } = await supabase
      .from('budget_items')
      .select('*')
      .or(`budget_id.eq.${budgetId},project_id.eq.${budgetId}`)
      .order('display_order');

    // Build items_list for FIC
    const itemsList = (budgetItems || []).map((item: any) => ({
      name: item.activity_name,
      description: item.category || '',
      qty: item.is_product ? item.hours_worked : 1,
      net_price: item.is_product
        ? item.hourly_rate
        : item.total_cost / (1 + (item.vat_rate || 22) / 100),
      vat: {
        id: 0, // FIC will use default VAT
        value: item.vat_rate || 22,
        description: `IVA ${item.vat_rate || 22}%`,
        is_disabled: false,
      },
      discount: 0,
      not_taxable: false,
    }));

    if (itemsList.length === 0) {
      throw new Error('Il preventivo non ha voci. Aggiungi almeno una voce prima di inviare.');
    }

    // Build document payload
    const discountPercentage = quote.discount_percentage || budget?.discount_percentage || 0;

    const documentPayload: any = {
      data: {
        type: 'quotes',
        entity: {
          id: ficClientId,
          name: client.name,
          email: client.email || undefined,
        },
        subject: `Preventivo ${quote.quote_number}`,
        items_list: itemsList,
        show_payments: true,
        show_payment_method: true,
      },
    };

    // Apply global discount if present
    if (discountPercentage > 0) {
      documentPayload.data.global_cassa_amount = 0;
      documentPayload.data.global_cassa_taxable = 100;
      // Apply discount per-item since FIC doesn't have a simple global discount field for quotes
      documentPayload.data.items_list = itemsList.map((item: any) => ({
        ...item,
        discount: discountPercentage,
      }));
    }

    console.log('Sending quote to FIC:', JSON.stringify(documentPayload).substring(0, 500));

    // Create document in FIC
    const createResult = await ficRequest(access_token, `/c/${company_id}/issued_documents`, {
      method: 'POST',
      body: JSON.stringify(documentPayload),
    });

    const ficDocumentId = createResult?.data?.id;
    if (!ficDocumentId) {
      throw new Error('Documento creato ma ID non restituito da FIC');
    }

    console.log('Quote sent to FIC, document ID:', ficDocumentId);

    // Save fic_document_id back to quotes table
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ fic_document_id: ficDocumentId })
      .eq('id', quoteId);

    if (updateError) {
      console.error('Error saving fic_document_id:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, fic_document_id: ficDocumentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending quote to FIC:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
