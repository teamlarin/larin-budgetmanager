// Funzione una tantum: carica in app_settings il testo delle condizioni
// generali di vendita Larin (articoli 1-27), estratto dal preventivo cartaceo.
// Va rimossa dopo l'uso: serve solo a portare il testo nel database senza
// incollarlo a mano.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import terms from './general-terms.json' with { type: 'json' };

const SEED_TOKEN = 'seed-offer-terms-2026-09-11';

Deno.serve(async (req) => {
  if (req.headers.get('x-seed-token') !== SEED_TOKEN) {
    return new Response(JSON.stringify({ error: 'non autorizzato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const articles = (terms as { articles: { number: number; title: string; text: string }[] }).articles ?? [];
  const text = articles.map((a) => `${a.number}. ${a.title}\n${a.text}`).join('\n\n');

  const payload = {
    articles,
    text,
    payment_details: (terms as { payment_details?: string }).payment_details ?? '',
    privacy_note: (terms as { privacy_note?: string }).privacy_note ?? '',
  };

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { setting_key: 'offer_general_terms', setting_value: payload, description: 'Condizioni generali di vendita mostrate nelle offerte' },
      { onConflict: 'setting_key' },
    );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, articles: articles.length, text_length: text.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
