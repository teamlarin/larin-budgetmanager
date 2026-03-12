import React from 'npm:react@18.3.1';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { ConfirmationEmail } from './_templates/confirmation-email.tsx';
import { sendEmail } from '../_shared/mandrill.ts';

const hookSecret = Deno.env.get('SEND_CONFIRMATION_EMAIL_HOOK_SECRET') as string;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);
  
  try {
    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
        user_metadata?: {
          first_name?: string;
          last_name?: string;
        };
      };
      email_data: {
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
    
    const firstName = user.user_metadata?.first_name || 'Utente';
    const lastName = user.user_metadata?.last_name || '';

    const html = await renderAsync(
      React.createElement(ConfirmationEmail, {
        firstName,
        lastName,
        confirmationUrl,
      })
    );

    await sendEmail({
      from_email: 'noreply@timetrap.it',
      from_name: 'TimeTrap',
      to: [user.email],
      subject: 'Conferma registrazione a TimeTrap',
      html,
    });

    console.log('Confirmation email sent successfully to:', user.email);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message || 'Unknown error',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
