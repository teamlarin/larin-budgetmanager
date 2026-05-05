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

  console.log('[FIC webhook] Token expired, refreshing...');
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
    console.error('[FIC webhook] Token refresh failed:', await response.text());
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

async function upsertSupplierFromFic(
  supabase: ReturnType<typeof createClient>,
  ficData: any,
  supplierId: number,
) {
  const s = ficData;
  const addressParts = [s.address_street, s.address_postal_code, s.address_city, s.address_province].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;

  const supplierData = {
    name: s.name,
    email: s.email || null,
    phone: s.phone || null,
    vat_number: s.vat_number || null,
    address,
    notes: s.notes || null,
  };

  // 1) match by fic_id
  let { data: existing } = await supabase.from('suppliers').select('id, user_id').eq('fic_id', supplierId).maybeSingle();

  // 2) fallback by vat_number
  if (!existing && s.vat_number) {
    const { data: byVat } = await supabase.from('suppliers').select('id, user_id').eq('vat_number', s.vat_number).maybeSingle();
    if (byVat) existing = byVat;
  }
  // 3) fallback by name
  if (!existing && s.name) {
    const { data: byName } = await supabase.from('suppliers').select('id, user_id').ilike('name', s.name).maybeSingle();
    if (byName) existing = byName;
  }

  if (existing) {
    const { error } = await supabase
      .from('suppliers')
      .update({ ...supplierData, fic_id: supplierId, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    return { action: 'updated', id: existing.id };
  }

  const { data: adminUser } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1).single();
  if (!adminUser) throw new Error('No admin user found');
  const { data: inserted, error } = await supabase
    .from('suppliers')
    .insert({ fic_id: supplierId, ...supplierData, user_id: adminUser.user_id })
    .select('id')
    .single();
  if (error) throw error;
  return { action: 'created', id: inserted.id };
}

serve(async (req) => {
  console.log('[FIC webhook]', req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Legacy GET verification
  if (req.method === 'GET') {
    const validationToken = new URL(req.url).searchParams.get('validationToken');
    if (validationToken) {
      console.log('[FIC webhook] GET validation');
      return new Response(validationToken, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    return jsonResponse({ ok: true, message: 'FIC webhook endpoint' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyText = await req.text();
    console.log('[FIC webhook] body:', bodyText.slice(0, 500));

    if (!bodyText?.trim()) {
      return jsonResponse({ success: true, message: 'empty body' });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.error('[FIC webhook] Invalid JSON');
      return jsonResponse({ success: true, message: 'invalid JSON' });
    }

    // FIC v2 verification handshake: { "verification": "<token>" }
    if (payload?.verification && typeof payload.verification === 'string') {
      console.log('[FIC webhook] Verification handshake, echoing token');
      return jsonResponse({ verification: payload.verification });
    }

    // Event payload — FIC v2 shape:
    // { event_type: "it.fattureincloud.webhooks.entities.suppliers.update", data: { entity: { id, type, ... } } }
    // Older variant: { type, data: { id, entity_type } }
    const eventType: string = payload.event_type || payload.type || '';
    const entity = payload.data?.entity || payload.data || {};
    const entityType: string = entity.type || entity.entity_type || '';
    const supplierId: number | undefined = entity.id || payload.data?.id;

    const isSupplierEvent = eventType.includes('suppliers') || entityType === 'supplier';
    if (!isSupplierEvent) {
      console.log('[FIC webhook] Ignoring non-supplier event:', eventType, entityType);
      return jsonResponse({ success: true, message: 'event ignored' });
    }
    if (!supplierId) {
      console.error('[FIC webhook] No supplier ID in payload');
      return jsonResponse({ success: true, message: 'no supplier id' });
    }

    const isDelete = eventType.endsWith('.delete') || eventType.endsWith('.deleted');
    const isCreateOrUpdate = !isDelete;

    // DELETE: just remove locally
    if (isDelete) {
      const { error } = await supabase.from('suppliers').delete().eq('fic_id', supplierId);
      if (error) {
        console.error('[FIC webhook] Delete error:', error);
        throw error;
      }
      console.log('[FIC webhook] Deleted supplier fic_id=', supplierId);
      return jsonResponse({ success: true, action: 'deleted', fic_id: supplierId });
    }

    // CREATE / UPDATE: fetch from FIC and upsert
    if (isCreateOrUpdate) {
      const ficToken = await getValidToken(supabase);
      const { access_token, company_id } = ficToken;

      const ficResponse = await fetch(`${FIC_API_BASE}/c/${company_id}/entities/suppliers/${supplierId}`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
      });

      if (ficResponse.status === 404) {
        console.log('[FIC webhook] 404 from FIC, deleting locally');
        await supabase.from('suppliers').delete().eq('fic_id', supplierId);
        return jsonResponse({ success: true, action: 'deleted_404', fic_id: supplierId });
      }
      if (!ficResponse.ok) {
        const text = await ficResponse.text();
        console.error('[FIC webhook] FIC API error:', ficResponse.status, text);
        throw new Error(`FIC API error: ${ficResponse.status} ${text}`);
      }

      const ficData = await ficResponse.json();
      const result = await upsertSupplierFromFic(supabase, ficData.data, supplierId);
      console.log('[FIC webhook]', result.action, 'supplier fic_id=', supplierId);
      return jsonResponse({ success: true, ...result, fic_id: supplierId });
    }

    return jsonResponse({ success: true, message: 'no action' });
  } catch (error) {
    console.error('[FIC webhook] Error:', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
