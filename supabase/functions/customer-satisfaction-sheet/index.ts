/**
 * Legge in diretta il foglio "Database Customer Satisfaction" tramite il
 * connettore Google Sheets (gateway Lovable). Sola lettura, nessuna scrittura.
 * L'accesso richiede un utente autenticato di TimeTrap.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SHEET_ID = '1ypzQcwmavl7-pxC2PLbp879-iUPh-e8EDnyR_aOz5eo';
const RANGE = 'Foglio1!A1:S2000';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';

/** Intestazioni del foglio → chiavi restituite al front-end. */
const HEADER_MAP: Record<string, string> = {
  'id customer': 'id',
  'data invio': 'sent_at',
  'data fine ciclo': 'cycle_end',
  'data compilazione': 'filled_at',
  'modalità raccolta': 'collection_mode',
  cliente: 'client',
  referente: 'contact',
  'mail referente': 'contact_email',
  progetto: 'project',
  account: 'account',
  'project leader': 'project_leader',
  area: 'area',
  'tipologia progetto': 'project_type',
  disciplina: 'discipline',
  marginalità: 'margin',
  nps: 'nps',
  'cosa potremmo migliorare?': 'improvements',
  'aspetti apprezzati': 'appreciated',
  note: 'notes',
};

/** Le date del foglio sono in formato italiano: le normalizzo a yyyy-MM-dd. */
function normalizeDate(value: string): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const it = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (it) return `${it[3]}-${it[2].padStart(2, '0')}-${it[1].padStart(2, '0')}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return trimmed.slice(0, 10);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autenticazione richiesta' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessione non valida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const connectionKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!lovableKey || !connectionKey) {
      return new Response(
        JSON.stringify({ error: 'Connessione Google Sheets non configurata' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const response = await fetch(`${GATEWAY_URL}/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': connectionKey,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`Google Sheets request failed [${response.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: 'Lettura del foglio non riuscita', status: response.status, details }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = await response.json();
    const values: string[][] = payload.values ?? [];
    const [headerRow, ...dataRows] = values;
    if (!headerRow) {
      return new Response(JSON.stringify({ rows: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keys = headerRow.map((header) => HEADER_MAP[(header ?? '').trim().toLowerCase()] ?? null);

    const rows = dataRows
      .map((row) => {
        const parsed: Record<string, unknown> = {};
        keys.forEach((key, index) => {
          if (!key) return;
          parsed[key] = (row[index] ?? '').toString().trim();
        });
        parsed.filled_at = normalizeDate(String(parsed.filled_at ?? ''));
        parsed.sent_at = normalizeDate(String(parsed.sent_at ?? ''));
        const npsRaw = String(parsed.nps ?? '').replace(',', '.');
        const npsValue = Number(npsRaw);
        parsed.nps = npsRaw !== '' && Number.isFinite(npsValue) ? npsValue : null;
        return parsed;
      })
      // Il foglio contiene una riga di istruzioni ("Da timetrap") e righe vuote.
      .filter((row) => {
        const client = String(row.client ?? '');
        const project = String(row.project ?? '');
        if (!client && !project) return false;
        if (client.toLowerCase() === 'da timetrap' || project.toLowerCase() === 'da timetrap') return false;
        return true;
      });

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('customer-satisfaction-sheet error', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
