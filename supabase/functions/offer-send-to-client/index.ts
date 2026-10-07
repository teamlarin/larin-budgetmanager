import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from '../_shared/mandrill.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendToClientRequest {
  offer_id: string;
  to?: string;
  message?: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Service role per le letture: non ci si fida di quello che manda il
    // browser (nome cliente, importo, riferimento), si rilegge tutto dal
    // database, come in send-budget-notification.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Richiede utente approvato (blocca account nuovi/non approvati), stesso
    // controllo di send-budget-notification.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('approved, deleted_at, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    if (!callerProfile?.approved || callerProfile.deleted_at) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { offer_id, to, message }: SendToClientRequest = await req.json();
    if (!offer_id) {
      return new Response(
        JSON.stringify({ error: 'offer_id mancante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Sending offer to client, offer:", offer_id, "by user:", user.id);

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id, year, number, title, client_id, current_version_id')
      .eq('id', offer_id)
      .maybeSingle();
    if (offerError || !offer) {
      return new Response(
        JSON.stringify({ error: 'Offerta non trovata' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!offer.current_version_id) {
      return new Response(
        JSON.stringify({ error: "L'offerta non ha ancora una versione corrente da inviare" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: version, error: versionError } = await supabase
      .from('offer_versions')
      .select('offered_total, valid_until')
      .eq('id', offer.current_version_id)
      .maybeSingle();
    if (versionError || !version) {
      throw new Error('Versione corrente dell\'offerta non trovata');
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name, email')
      .eq('id', offer.client_id)
      .maybeSingle();
    if (clientError || !client) {
      throw new Error('Cliente non trovato');
    }

    const recipient = (to && to.trim()) || client.email || null;
    if (!recipient) {
      return new Response(
        JSON.stringify({ error: 'Il cliente non ha un indirizzo email in anagrafica: specifica un destinatario.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link attivo dell'offerta: se manca, lo si crea con il JWT di chi sta
    // inviando (non con il service role) perché create_offer_public_link si
    // appoggia ad auth.uid() sia per l'autorizzazione (can_manage_offer) sia
    // per valorizzare created_by.
    let publicLinkId: string;
    let publicLinkToken: string;
    const { data: existingLink } = await supabase
      .from('offer_public_links')
      .select('id, token')
      .eq('offer_id', offer_id)
      .is('revoked_at', null)
      .maybeSingle();

    if (existingLink) {
      publicLinkId = existingLink.id;
      publicLinkToken = existingLink.token;
    } else {
      const supabaseAsUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: newLink, error: createLinkError } = await supabaseAsUser.rpc('create_offer_public_link', {
        _offer_id: offer_id,
      });
      if (createLinkError || !newLink) {
        return new Response(
          JSON.stringify({ error: createLinkError?.message || 'Impossibile generare il link pubblico' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      publicLinkId = newLink.id;
      publicLinkToken = newLink.token;
    }

    // Dominio pubblico dell'app e mittente: da variabili d'ambiente, con un
    // valore di ripiego sensato se non ancora configurate (vedi rapporto).
    // Priorità: impostazione applicativa 'public_site_url' (modificabile dagli
    // admin senza rideploy), poi variabile d'ambiente SITE_URL, poi ripiego.
    const { data: siteUrlSetting } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'public_site_url')
      .maybeSingle();
    const configuredUrl = typeof siteUrlSetting?.value === 'string'
      ? siteUrlSetting.value
      : siteUrlSetting?.value?.url;
    const siteUrl = (configuredUrl || Deno.env.get('SITE_URL') || 'https://larin.timetrap.it').replace(/\/+$/, '');
    const fromEmail = Deno.env.get('OFFER_SENDER_EMAIL') || 'noreply@timetrap.it';
    const fromName = Deno.env.get('OFFER_SENDER_NAME') || 'Larin';

    const linkUrl = `${siteUrl}/offerta/${publicLinkToken}`;
    const reference = `${offer.year}/${offer.number}`;
    const title = (offer.title ?? '').trim();
    const senderName = [callerProfile.first_name, callerProfile.last_name].filter(Boolean).join(' ').trim();

    const subject = title ? `Offerta ${reference} – ${title} | Larin` : `Offerta ${reference} da Larin`;

    const P = 'margin: 0 0 14px; font-size: 15px; color: #21282A;';
    const messageParagraph = message?.trim()
      ? `<p style="${P} white-space: pre-line;">${escapeHtml(message.trim())}</p>`
      : '';

    const fmtEur = (n: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0) + ' €';
    const row = (label: string, value: string) => `<tr><td style="padding: 6px 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #8A9092; width: 140px; vertical-align: top;">${label}</td><td style="padding: 6px 0; font-size: 15px; color: #21282A;">${value}</td></tr>`;
    const validityLine = version.valid_until ? row('Valida fino al', new Date(version.valid_until).toLocaleDateString('it-IT')) : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #21282A; margin: 0; padding: 32px 16px; background-color: #F5F4F1;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E1DC; border-radius: 6px; box-shadow: 0 2px 12px rgba(33,40,42,0.05);">
          <div style="padding: 36px 44px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;"><tr>
              <td style="vertical-align: middle; padding-right: 12px;">
                <div style="width: 30px; height: 30px; border: 1.5px solid #21282A; border-radius: 50%; text-align: center; line-height: 0;">
                  <div style="padding-top: 7px;"><span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#21282A;"></span><br><span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#21282A;margin-top:2px;"></span><br><span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#21282A;margin-top:2px;"></span></div>
                </div>
              </td>
              <td style="vertical-align: middle;">
                <div style="font-size: 18px; font-weight: 700; letter-spacing: 0.22em; color: #21282A; line-height: 1;">LARIN</div>
                <div style="font-size: 9px; letter-spacing: 0.24em; color: #8A9092; margin-top: 4px;">CONNECT THE DOTS</div>
              </td>
            </tr></table>
            <div style="width: 36px; height: 3px; background-color: #F7DB45; margin-top: 22px;"></div>
          </div>
          <div style="padding: 8px 44px 36px;">
            <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #8A9092; margin-bottom: 6px;">Offerta ${reference}</div>
            <h1 style="color: #21282A; font-size: 24px; font-weight: 600; line-height: 1.3; margin: 0 0 22px;">${title ? escapeHtml(title) : 'La sua offerta è pronta'}</h1>
            ${messageParagraph || `<p style="${P}">Gentile ${escapeHtml(client.name)},</p>
            <p style="${P}">Le inviamo l'offerta <strong>${reference}${title ? ` – ${escapeHtml(title)}` : ''}</strong>, a disposizione per essere consultata e, se concorda, accettata online.</p>`}
            <div style="background-color: #FAF9F7; border: 1px solid #E2E1DC; border-radius: 4px; padding: 16px 22px; margin: 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                ${row('Offerta', reference)}
                ${title ? row('Oggetto', escapeHtml(title)) : ''}
                ${row('Importo', `<strong>${fmtEur(version.offered_total)}</strong>`)}
                ${validityLine}
              </table>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${linkUrl}" style="display: inline-block; background-color: #21282A; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 999px; font-size: 14px; letter-spacing: 0.04em;">Apri l'offerta</a>
            </div>
            <p style="font-size: 12px; color: #8A9092; word-break: break-all;">Se il pulsante non funziona, copi e incolli questo indirizzo nel browser:<br>${linkUrl}</p>
            <p style="font-size: 15px; color: #4E5758; margin-top: 26px;">Cordiali saluti,<br><span style="color: #21282A;">${senderName ? `${escapeHtml(senderName)} – Larin` : 'Il team Larin'}</span></p>
          </div>
          <div style="padding: 18px 44px; border-top: 1px solid #E2E1DC; text-align: center;">
            <p style="color: #8A9092; font-size: 10px; letter-spacing: 0.22em; margin: 0;">LARIN · CONNECT THE DOTS</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await sendEmail({
      from_email: fromEmail,
      from_name: fromName,
      to: [recipient],
      subject,
      html: htmlContent,
    });

    console.log("Offer email sent successfully:", emailResponse);

    // "Gliel'ho mandata o no?" deve avere risposta anche mezz'ora dopo: si
    // registra l'invio (contatore + destinatario + istante) sul link. Non
    // blocca la risposta di successo: l'email è già partita, un fallimento
    // qui sarebbe solo un dato di tracciamento mancante, non un invio fallito.
    const { error: recordSentError } = await supabase.rpc('record_offer_link_sent', {
      _public_link_id: publicLinkId,
      _sent_to: recipient,
    });
    if (recordSentError) {
      console.error("Error recording offer link sent:", recordSentError);
    }

    return new Response(
      JSON.stringify({ ok: true, sent_to: recipient, link_url: linkUrl }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in offer-send-to-client function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
