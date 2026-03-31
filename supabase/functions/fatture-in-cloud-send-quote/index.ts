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

const FIC_API_BASE = 'https://api-v2.fattureincloud.it';
const FIC_TOKEN_URL = `${FIC_API_BASE}/oauth/token`;

const BodySchema = z.object({
  quoteId: z.string().uuid(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getValidToken(supabase: ReturnType<typeof createClient>) {
  const { data: tokens, error } = await supabase
    .from('fic_oauth_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !tokens) throw new Error('Fatture in Cloud non connesso. Collegare prima l\'account.');

  const isExpired = new Date(tokens.token_expiry) < new Date(Date.now() + 5 * 60 * 1000);
  if (!isExpired) return tokens;

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
    console.error('Token refresh failed:', await response.text());
    throw new Error('Token scaduto e refresh fallito. Ricollegare l\'account.');
  }

  const data = await response.json();
  const tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  await supabase.from('fic_oauth_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    token_expiry: tokenExpiry.toISOString(),
  }).eq('id', tokens.id);

  return { ...tokens, access_token: data.access_token, token_expiry: tokenExpiry.toISOString() };
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
  supabase: ReturnType<typeof createClient>,
  token: string,
  companyId: number,
  client: { id: string; name: string; email?: string | null; phone?: string | null; fic_id?: number | null },
): Promise<number> {
  if (client.fic_id) return client.fic_id;

  const searchResult = await ficRequest(token, `/c/${companyId}/entities/clients?q=${encodeURIComponent(client.name)}`);
  const existing = searchResult?.data?.find((e: { name?: string; id: number }) =>
    e.name?.toLowerCase() === client.name?.toLowerCase()
  );

  if (existing) {
    await supabase.from('clients').update({ fic_id: existing.id }).eq('id', client.id);
    return existing.id;
  }

  const createResult = await ficRequest(token, `/c/${companyId}/entities/clients`, {
    method: 'POST',
    body: JSON.stringify({
      data: { name: client.name, email: client.email || undefined, phone: client.phone || undefined, type: 'company' },
    }),
  });

  const ficId = createResult?.data?.id;
  if (!ficId) throw new Error('Impossibile creare il cliente su Fatture in Cloud');

  await supabase.from('clients').update({ fic_id: ficId }).eq('id', client.id);
  return ficId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // JWT validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.user) {
      return jsonResponse({ error: 'Token non valido' }, 401);
    }

    // Validate body
    let body: unknown;
    try { body = await req.json(); } catch { return jsonResponse({ error: 'Body JSON non valido' }, 400); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { quoteId } = parsed.data;

    // Load quote with budget and client
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, budgets (*, clients (*))')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) throw new Error('Preventivo non trovato');

    const budget = (quote as any).budgets;
    const client = budget?.clients;
    if (!client) throw new Error('Il preventivo non ha un cliente associato.');

    // Get FIC token
    const ficToken = await getValidToken(supabase);
    const { access_token, company_id } = ficToken;

    // Find or create client in FIC
    const ficClientId = await findOrCreateFicClient(supabase, access_token, company_id, client);

    // Load budget items
    const budgetId = (quote as any).budget_id || (quote as any).project_id;
    const { data: budgetItems } = await supabase
      .from('budget_items')
      .select('*')
      .or(`budget_id.eq.${budgetId},project_id.eq.${budgetId}`)
      .order('display_order');

    const itemsList = (budgetItems || []).map((item: any) => ({
      name: item.activity_name,
      description: item.category || '',
      qty: item.is_product ? item.hours_worked : 1,
      net_price: item.is_product ? item.hourly_rate : item.total_cost / (1 + (item.vat_rate || 22) / 100),
      vat: { id: 0, value: item.vat_rate || 22, description: `IVA ${item.vat_rate || 22}%`, is_disabled: false },
      discount: 0,
      not_taxable: false,
    }));

    if (itemsList.length === 0) throw new Error('Il preventivo non ha voci.');

    const discountPercentage = (quote as any).discount_percentage || budget?.discount_percentage || 0;

    const documentPayload: any = {
      data: {
        type: 'quotes',
        entity: { id: ficClientId, name: client.name, email: client.email || undefined },
        subject: `Preventivo ${(quote as any).quote_number}`,
        items_list: discountPercentage > 0
          ? itemsList.map((item: any) => ({ ...item, discount: discountPercentage }))
          : itemsList,
        show_payments: true,
        show_payment_method: true,
      },
    };

    console.log('Sending quote to FIC:', JSON.stringify(documentPayload).substring(0, 500));

    const createResult = await ficRequest(access_token, `/c/${company_id}/issued_documents`, {
      method: 'POST',
      body: JSON.stringify(documentPayload),
    });

    const ficDocumentId = createResult?.data?.id;
    if (!ficDocumentId) throw new Error('Documento creato ma ID non restituito da FIC');

    console.log('Quote sent to FIC, document ID:', ficDocumentId);

    await supabase.from('quotes').update({ fic_document_id: ficDocumentId }).eq('id', quoteId);

    return jsonResponse({ success: true, fic_document_id: ficDocumentId });
  } catch (error) {
    console.error('Error sending quote to FIC:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
