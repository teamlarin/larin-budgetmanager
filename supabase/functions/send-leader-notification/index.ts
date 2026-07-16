import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/mandrill.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LeaderNotificationRequest {
  user_id: string;
  project_id: string;
  project_name: string;
  client_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // This endpoint is only invoked internally by DB triggers using the service role key.
    // Reject anything that doesn't present the service-role bearer.
    if (!authHeader || authHeader.replace("Bearer ", "").trim() !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, project_id }: LeaderNotificationRequest = await req.json();

    // Re-fetch project + client from DB (do not trust request payload)
    const { data: projectRow } = await supabase
      .from("projects")
      .select("id, name, client_id")
      .eq("id", project_id)
      .maybeSingle();
    if (!projectRow) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const project_name = projectRow.name as string;
    let client_name: string | undefined;
    if (projectRow.client_id) {
      const { data: c } = await supabase.from("clients").select("name").eq("id", projectRow.client_id).maybeSingle();
      client_name = c?.name as string | undefined;
    }

    console.log("Sending leader notification for project:", project_name, "to user:", user_id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.email) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = profile.first_name 
      ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
      : 'Utente';

    const clientInfo = client_name ? ` per il cliente ${client_name}` : '';

    const emailResponse = await sendEmail({
      from_email: 'noreply@timetrap.it',
      from_name: 'TimeTrap',
      to: [profile.email],
      subject: `Sei stato assegnato come Project Leader: ${project_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a3330; margin: 0; padding: 20px; background-color: #f2f8f6;">
          <div style="max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 25px -8px rgba(61,190,170,0.25);">
            <div style="background: linear-gradient(135deg, #3dbeaa, #fac320); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">TimeTrap</h1>
            </div>
            <div style="background-color: #ffffff; padding: 32px 40px;">
              <h2 style="color: #1a3330; font-size: 22px; font-weight: 700; margin: 0 0 16px;">👑 Nuovo Progetto Assegnato</h2>
              <p style="font-size: 15px;">Ciao <strong>${userName}</strong>,</p>
              <p style="font-size: 15px;">Sei stato assegnato come <strong>Project Leader</strong> per un nuovo progetto${clientInfo}.</p>
              <div style="background-color: #f2f8f6; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #cce5df;">
                <span style="display: inline-block; background-color: #3dbeaa; color: #ffffff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700;">Project Leader</span>
                <h3 style="margin: 12px 0 5px 0; color: #1a3330; font-size: 18px;">${project_name}</h3>
                ${client_name ? `<p style="margin: 0; color: #527a73; font-size: 14px;">Cliente: ${client_name}</p>` : ''}
              </div>
              <p style="font-size: 15px;">In qualità di Project Leader, sarai responsabile della gestione e del coordinamento delle attività del progetto.</p>
              <p style="font-size: 15px;">Accedi alla piattaforma per visualizzare i dettagli e iniziare a pianificare.</p>
            </div>
            <div style="background-color: #f2f8f6; padding: 20px 40px; text-align: center; border-top: 1px solid #cce5df;">
              <p style="color: #527a73; font-size: 12px; margin: 0;">TimeTrap — Gestione Progetti e Budget</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-leader-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
