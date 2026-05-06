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
  action: z.enum(['check', 'register', 'delete', 'sync-all', 'verify']),
  subscriptionId: z.string().optional(),
});

async function upsertSupplierFromFic(
  supabase: ReturnType<typeof createClient>,
  s: any,
  supplierId: number,
  defaultUserId: string,
) {
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

  let { data: existing } = await supabase.from('suppliers').select('id').eq('fic_id', supplierId).maybeSingle();
  if (!existing && s.vat_number) {
    const { data: byVat } = await supabase.from('suppliers').select('id').eq('vat_number', s.vat_number).maybeSingle();
    if (byVat) existing = byVat;
  }
  if (!existing && s.name) {
    const { data: byName } = await supabase.from('suppliers').select('id').ilike('name', s.name).maybeSingle();
    if (byName) existing = byName;
  }

  if (existing) {
    const { error } = await supabase
      .from('suppliers')
      .update({ ...supplierData, fic_id: supplierId, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    return 'updated';
  }
  const { error } = await supabase
    .from('suppliers')
    .insert({ fic_id: supplierId, ...supplierData, user_id: defaultUserId });
  if (error) throw error;
  return 'created';
}

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
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !userData?.user) {
      return jsonResponse({ error: 'Token non valido' }, 401);
    }

    // Admin check
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return jsonResponse({ error: 'Solo gli admin possono gestire i webhook' }, 403);
    }

    // Validate body
    let body: unknown;
    try { body = await req.json(); } catch { return jsonResponse({ error: 'Body JSON non valido' }, 400); }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { action, subscriptionId } = parsed.data;
    const ficToken = await getValidToken(supabase);
    const { access_token, company_id } = ficToken;

    if (action === 'check') {
      const res = await fetch(`${FIC_API_BASE}/c/${company_id}/subscriptions`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
      });
      if (!res.ok) { console.error('List subscriptions error:', await res.text()); return jsonResponse({ subscriptions: [] }); }
      const data = await res.json();
      return jsonResponse({ subscriptions: data.data || [] });
    }

    if (action === 'register') {
      const webhookUrl = `${supabaseUrl}/functions/v1/fatture-in-cloud-webhook`;
      const payload = {
        data: {
          sink: webhookUrl,
          types: [
            'it.fattureincloud.webhooks.entities.suppliers.create',
            'it.fattureincloud.webhooks.entities.suppliers.update',
            'it.fattureincloud.webhooks.entities.suppliers.delete',
          ],
        },
      };

      const res = await fetch(`${FIC_API_BASE}/c/${company_id}/subscriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Create subscription error:', text);
        throw new Error(`Errore nella creazione del webhook: ${text}`);
      }

      return jsonResponse({ success: true, message: 'Webhook registrato con successo', subscription: (await res.json()).data });
    }

    if (action === 'delete') {
      if (!subscriptionId) return jsonResponse({ error: 'subscriptionId obbligatorio per delete' }, 400);
      const res = await fetch(`${FIC_API_BASE}/c/${company_id}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error(`Errore nell'eliminazione: ${await res.text()}`);
      return jsonResponse({ success: true, message: 'Subscription eliminata' });
    }

    if (action === 'sync-all') {
      let page = 1;
      const ficIds = new Set<number>();
      let created = 0, updated = 0;
      const errors: string[] = [];

      while (true) {
        const res = await fetch(
          `${FIC_API_BASE}/c/${company_id}/entities/suppliers?per_page=100&page=${page}`,
          { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' } },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Errore lettura fornitori FIC: ${res.status} ${text}`);
        }
        const json = await res.json();
        const items: any[] = json.data || [];
        for (const s of items) {
          try {
            ficIds.add(s.id);
            const result = await upsertSupplierFromFic(supabase, s, s.id, userData.user.id);
            if (result === 'created') created++; else updated++;
          } catch (e) {
            errors.push(`${s.name || s.id}: ${(e as Error).message}`);
          }
        }
        const last = json.last_page ?? json.meta?.last_page ?? page;
        if (page >= last || items.length === 0) break;
        page++;
      }

      // Delete local suppliers whose fic_id no longer exists in FIC
      const { data: localWithFic } = await supabase
        .from('suppliers')
        .select('id, fic_id')
        .not('fic_id', 'is', null);

      const toDelete = (localWithFic || []).filter((s: any) => !ficIds.has(s.fic_id)).map((s: any) => s.id);
      let deleted = 0;
      if (toDelete.length > 0) {
        const { error: delErr, count } = await supabase
          .from('suppliers')
          .delete({ count: 'exact' })
          .in('id', toDelete);
        if (delErr) errors.push(`Delete error: ${delErr.message}`);
        else deleted = count || toDelete.length;
      }

      // Save last sync timestamp
      await supabase.from('app_settings').upsert(
        {
          setting_key: 'fic_suppliers_last_sync',
          setting_value: { at: new Date().toISOString(), created, updated, deleted, errors: errors.length },
          description: 'Ultima sincronizzazione fornitori FIC',
        },
        { onConflict: 'setting_key' },
      );

      return jsonResponse({ success: true, created, updated, deleted, total: ficIds.size, errors });
    }

    return jsonResponse({ error: 'Azione non valida' }, 400);
  } catch (error) {
    console.error('Register webhook error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
