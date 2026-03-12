import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { sendEmail } from '../_shared/mandrill.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorizzato' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorizzato' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRoles, error: rolesError } = await supabaseClient
      .from('user_roles').select('role').eq('user_id', user.id);

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: 'Errore nel controllo permessi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userRoles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Permesso negato. Solo gli admin possono reimpostare le password.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId }: ResetPasswordRequest = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId è obbligatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetUser, error: userError } = await supabaseClient
      .from('profiles').select('email').eq('id', userId).single();

    if (userError || !targetUser?.email) {
      return new Response(
        JSON.stringify({ error: 'Utente non trovato' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://31978e0e-9f78-4c64-b31f-dc43fd04a2fe.lovableproject.com';
    const redirectTo = `${origin}/reset-password`;

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: targetUser.email,
      options: { redirectTo },
    });

    if (resetError) {
      return new Response(
        JSON.stringify({ error: 'Errore nella generazione del link di reset' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await sendEmail({
      from_email: 'noreply@timetrap.it',
      from_name: 'TimeTrap',
      to: [targetUser.email],
      subject: 'Reset Password - TimeTrap',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
          </head>
          <body style="font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a3330; margin: 0; padding: 20px; background-color: #f2f8f6;">
            <div style="max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 25px -8px rgba(61,190,170,0.25);">
              <div style="background: linear-gradient(135deg, #3dbeaa, #fac320); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">TimeTrap</h1>
              </div>
              <div style="background-color: #ffffff; padding: 32px 40px;">
                <h2 style="color: #1a3330; font-size: 22px; font-weight: 700; margin: 0 0 16px;">Reset Password</h2>
                <p style="font-size: 15px; color: #1a3330;">È stata ricevuta una richiesta di reset password per il tuo account.</p>
                <p style="font-size: 15px; color: #1a3330;">Clicca sul pulsante qui sotto per reimpostare la tua password:</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${resetData.properties.action_link}" 
                     style="background-color: #3dbeaa; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 700; font-size: 15px;">
                    Reimposta Password
                  </a>
                </div>
                <p style="color: #527a73; font-size: 13px;">Se non hai richiesto il reset della password, puoi ignorare questa email.</p>
                <p style="color: #527a73; font-size: 13px;">Il link scadrà tra 1 ora.</p>
              </div>
              <div style="background-color: #f2f8f6; padding: 20px 40px; text-align: center; border-top: 1px solid #cce5df;">
                <p style="color: #527a73; font-size: 12px; margin: 0;">TimeTrap — Gestione Progetti e Budget</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Password reset email sent successfully to:', targetUser.email);

    return new Response(
      JSON.stringify({ success: true, message: 'Email di reset password inviata con successo' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Errore del server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
