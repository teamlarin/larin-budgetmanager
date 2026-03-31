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

  if (error || !tokens) throw new Error('Nessun token FIC trovato');

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
    throw new Error('Token FIC scaduto e refresh fallito');
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

serve(async (req) => {
  console.log('Webhook received:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle FIC verification (GET with validationToken)
  if (req.method === 'GET') {
    const validationToken = new URL(req.url).searchParams.get('validationToken');
    if (validationToken) {
      console.log('Webhook verification request');
      return new Response(validationToken, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyText = await req.text();
    console.log('Webhook body:', bodyText);

    if (!bodyText?.trim()) {
      return jsonResponse({ success: true, message: 'Webhook endpoint active' });
    }

    let payload: { type?: string; data?: { id?: number; entity_type?: string } };
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.error('Invalid JSON received');
      return jsonResponse({ success: true, message: 'Invalid JSON' });
    }

    const eventType = payload.type || '';
    const isSupplierEvent = eventType.includes('suppliers') || payload.data?.entity_type === 'supplier';

    if (!isSupplierEvent) {
      console.log('Ignoring non-supplier event:', eventType);
      return jsonResponse({ success: true, message: 'Event ignored' });
    }

    // Get valid token with auto-refresh
    const ficToken = await getValidToken(supabase);
    const { access_token, company_id } = ficToken;

    const supplierId = payload.data?.id;
    if (!supplierId) {
      console.error('No supplier ID in payload');
      return jsonResponse({ success: true, message: 'No supplier ID' });
    }

    console.log('Fetching supplier:', supplierId, 'Company:', company_id);

    const ficResponse = await fetch(`${FIC_API_BASE}/c/${company_id}/entities/suppliers/${supplierId}`, {
      headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
    });

    // If 404, supplier was deleted
    if (ficResponse.status === 404) {
      console.log('Supplier deleted in FIC, removing locally');
      await supabase.from('suppliers').delete().eq('fic_id', supplierId);
      return jsonResponse({ success: true, message: 'Supplier deleted' });
    }

    if (!ficResponse.ok) {
      throw new Error(`FIC API error: ${ficResponse.status} ${await ficResponse.text()}`);
    }

    const ficData = await ficResponse.json();
    const s = ficData.data;

    const addressParts = [s.address_street, s.address_postal_code, s.address_city, s.address_province].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : null;

    // Upsert supplier
    const { data: existing } = await supabase.from('suppliers').select('id, user_id').eq('fic_id', supplierId).maybeSingle();

    const supplierData = {
      name: s.name,
      email: s.email || null,
      phone: s.phone || null,
      vat_number: s.vat_number || null,
      address,
      notes: s.notes || null,
    };

    if (existing) {
      const { error } = await supabase.from('suppliers').update({ ...supplierData, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
      console.log('Updated supplier:', existing.id);
    } else {
      const { data: adminUser } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1).single();
      if (!adminUser) throw new Error('No admin user found');
      const { error } = await supabase.from('suppliers').insert({ fic_id: supplierId, ...supplierData, user_id: adminUser.user_id });
      if (error) throw error;
      console.log('Created new supplier from FIC');
    }

    return jsonResponse({ success: true, message: 'Supplier synced' });
  } catch (error) {
    console.error('Webhook error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
