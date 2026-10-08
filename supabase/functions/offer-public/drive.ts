import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

async function tokenFor(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: t } = await supabase.from('user_google_tokens').select('*').eq('user_id', userId).maybeSingle();
  if (!t) return null;
  if (new Date(t.token_expiry) > new Date(Date.now() + 60_000)) return t.access_token;
  if (!t.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: t.refresh_token, grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  await supabase.from('user_google_tokens').update({
    access_token: j.access_token,
    token_expiry: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  }).eq('user_id', userId);
  return j.access_token;
}

/**
 * Copia il PDF firmato nella cartella Drive del cliente (best effort).
 * Usa il token Google di chi ha creato l'offerta, poi quello di un admin.
 * Idempotente: se esiste già un file con lo stesso nome nella cartella, non ricarica.
 */
export async function copySignedPdfToClientDrive(
  supabase: SupabaseClient,
  offerVersionId: string,
  bucket: string,
): Promise<void> {
  const { data: sig } = await supabase.from('offer_signatures')
    .select('signed_pdf_path').eq('offer_version_id', offerVersionId).eq('decision', 'accettata')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!sig?.signed_pdf_path) return;

  const { data: version } = await supabase.from('offer_versions').select('offer_id').eq('id', offerVersionId).maybeSingle();
  if (!version) return;
  const { data: offer } = await supabase.from('offers')
    .select('id, client_id, created_by, year, number, title').eq('id', version.offer_id).maybeSingle();
  if (!offer) return;
  const { data: client } = await supabase.from('clients').select('drive_folder_id').eq('id', offer.client_id).maybeSingle();
  const folderId = client?.drive_folder_id;
  if (!folderId) { console.log('drive copy skipped: client without drive folder'); return; }

  const candidates: string[] = [];
  if (offer.created_by) candidates.push(offer.created_by);
  const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  for (const a of admins ?? []) if (!candidates.includes(a.user_id)) candidates.push(a.user_id);

  let token: string | null = null;
  for (const uid of candidates) { token = await tokenFor(supabase, uid); if (token) break; }
  if (!token) { console.log('drive copy skipped: no google token'); return; }

  const safeTitle = (offer.title ?? '').replace(/[\\/:*?"<>|]/g, '-').trim();
  const fileName = `Offerta ${offer.year}-${offer.number}${safeTitle ? ` - ${safeTitle}` : ''} (firmata).pdf`;

  const q = `name='${fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (search.ok && ((await search.json()).files ?? []).length > 0) return;

  const { data: blob, error } = await supabase.storage.from(bucket).download(sig.signed_pdf_path);
  if (error || !blob) { console.error('drive copy: pdf download failed', error); return; }

  const boundary = `b${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/pdf' });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  const up = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
  );
  if (!up.ok) console.error('drive upload failed', up.status, await up.text());
  else console.log('signed pdf copied to client drive', (await up.json()).id);
}
