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
      subject: 'Reset Password - Budget Manager',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; margin-bottom: 20px;">
              <h1 style="color: #2563eb; margin-top: 0;">Reset Password</h1>
              <p>È stata ricevuta una richiesta di reset password per il tuo account.</p>
              <p>Clicca sul pulsante qui sotto per reimpostare la tua password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetData.properties.action_link}" 
                   style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Reimposta Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">Se non hai richiesto il reset della password, puoi ignorare questa email.</p>
              <p style="color: #666; font-size: 14px;">Il link scadrà tra 1 ora.</p>
            </div>
            <div style="text-align: center; color: #999; font-size: 12px;">
              <p>Budget Manager</p>
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
